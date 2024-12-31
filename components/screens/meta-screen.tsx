"use client";

import { FC, ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ServerApi } from "@/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ReactPlayer from "react-player";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import qs from "qs";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  CircleCheck,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Image from "next/image";
import { durationToText, getBackdropUrl } from "@/lib/utils";
import { create } from "zustand";
import { Skeleton } from "@/components/ui/skeleton";
import { EpisodeView } from "@/components/cards/episode-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VideoView } from "@/components/cards/video-view";
import Link from "next/link";
import { SeasonView } from "@/components/cards/season-view";

interface PreviewPlayerState {
  MetaScreenPlayerMuted: boolean;
  setMetaScreenPlayerMuted: (value: boolean) => void;
}

export const usePreviewPlayer = create<PreviewPlayerState>((set) => ({
  MetaScreenPlayerMuted: true,
  setMetaScreenPlayerMuted: (value) => set({ MetaScreenPlayerMuted: value }),
}));

// Add type for Image
interface PlexImage {
  type: string;
  url: string;
}

// Helper function to find clear logo
const findClearLogo = (images?: PlexImage[]): PlexImage | undefined => {
  if (!images) return undefined;
  return images.find(img => img.type === 'clearLogo');
};

// Add types for TMDB
interface TmdbResponse {
  movie_results?: Array<{
    backdrop_path?: string;
  }>;
  tv_results?: Array<{
    backdrop_path?: string;
  }>;
}

interface PlexGuid {
  id: string;
}

// Helper function to extract IMDB ID from Guid array
const findImdbId = (guid?: Array<{ id: string }>): string | undefined => {
  console.log("guid", guid);
  if (!guid) return undefined;
  const imdbGuid = guid.find(g => g.id.startsWith('imdb://'));
  return imdbGuid ? imdbGuid.id.replace('imdb://', '') : undefined;
};

// Helper function to get backdrop from TMDB
const getTmdbBackdrop = async (imdbId: string): Promise<string | undefined> => {
  const url = `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4NDUzN2ZiN2U0N2VlMDI2Y2VhMTMwN2NmZTc2MzkzOSIsIm5iZiI6MTcwMzI5NzIzNy45MjEsInN1YiI6IjY1ODY0MGQ1NWFiYTMyNjc1OWI5MDQwNiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.LfkrBQFZDbQNF4AN-F1Z2o9YKLA9jRn4D42L9ooKcE4'
    }
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json() as TmdbResponse;
    const backdropPath = data.movie_results?.[0]?.backdrop_path || data.tv_results?.[0]?.backdrop_path;
    return backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : undefined;
  } catch (error) {
    console.error('Error fetching TMDB backdrop:', error);
    return undefined;
  }
};

export const MetaScreen: FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mid = searchParams.get("mid");
  const { MetaScreenPlayerMuted, setMetaScreenPlayerMuted } =
    usePreviewPlayer();

  const metadata = useQuery({
    queryKey: ["metadata", mid],
    queryFn: async () => {
      if (!mid) return null;
      return ServerApi.metadata({ id: mid });
    },
  });
  const related = useQuery({
    queryKey: ["related", metadata.data],
    queryFn: async () => {
      if (!metadata.data) return [];
      let id = metadata.data.ratingKey;
      if (metadata.data.type === "season" && metadata.data.parentRatingKey) {
        id = metadata.data.parentRatingKey;
      } else if (
        metadata.data.type === "episode" &&
        metadata.data.grandparentRatingKey
      ) {
        id = metadata.data.grandparentRatingKey;
      }
      return await ServerApi.related({ id });
    },
  });

  const [episodes, setEpisodes] = useState<{
    value: Plex.Metadata[];
    count: number;
  } | null>(null);

  const [languages, setLanguages] = useState<string[] | null>(null);
  const [subtitles, setSubtitles] = useState<string[] | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [playing, setPlaying] = useState<boolean>(false);

  const token = localStorage.getItem("token");

  const [backdropUrl, setBackdropUrl] = useState<string | null>(null);

  useEffect(() => {
    setEpisodes(null);
    setLanguages(null);
    setSubtitles(null);
    setPreview(null);
    setPlaying(false);
  }, [metadata.data?.ratingKey]);

  useEffect(() => {
    if (!metadata.data) return;
    const extras = metadata.data.Extras?.Metadata;
    if (!extras?.[0] || !extras?.[0]?.Media?.[0]?.Part?.[0]?.key) return;

    setPreview(
      `${localStorage.getItem("server")}${
        extras?.[0]?.Media?.[0]?.Part?.[0]?.key
      }&X-Plex-Token=${token}`,
    );

    const timeout = setTimeout(() => {
      setPlaying(true);
    }, 3000);

    return () => clearTimeout(timeout);
  }, [metadata.data]);

  useEffect(() => {
    if (languages || subtitles) return;
    if (!metadata.data) return;

    if (metadata.data.type === "show") {
      if (!episodes) return;

      // get the first episode to get the languages and subtitles
      // you need to request the full metadata for the episode to get the media info
      ServerApi.metadata({ id: episodes.value[0].ratingKey }).then((data) => {
        const streams = data?.Media?.[0]?.Part?.[0]?.Stream || null;
        if (!streams) return;

        setLanguages(
          Array.from(
            new Set(
              streams
                .filter((stream) => stream.language && stream.streamType === 2)
                .map((stream) => stream.language ?? stream.displayTitle),
            ),
          ),
        );
        setSubtitles(
          Array.from(
            new Set(
              streams
                .filter((stream) => stream.language && stream.streamType === 3)
                .map((stream) => stream.language),
            ),
          ),
        );
      });
    } else if (metadata.data.type === "movie") {
      const streams = metadata.data?.Media?.[0]?.Part?.[0]?.Stream || null;
      if (!streams) return;

      setLanguages(
        Array.from(
          new Set(
            streams
              .filter((stream) => stream.language && stream.streamType === 2)
              .map((stream) => stream.language ?? stream.displayTitle),
          ),
        ),
      );
      setSubtitles(
        Array.from(
          new Set(
            streams
              .filter((stream) => stream.language && stream.streamType === 3)
              .map((stream) => stream.language),
          ),
        ),
      );
    }
  }, [metadata.data?.ratingKey, episodes]);

  useEffect(() => {
    setEpisodes(null);
    if (!metadata.data) return;
    let id = "";
    if (metadata.data.type === "season") {
      id = metadata.data.ratingKey;
    }
    if (!id) return;

    ServerApi.children({ id }).then((data) => {
      if (data) {
        setEpisodes({
          value: data,
          count: data.reduce((max, e) => {
            if (!e.index) return max;
            const v = e.index === 0 ? 1 : Math.abs(e.index).toString().length;
            return max < v ? v : max;
          }, 0),
        });
      } else {
        setEpisodes(null);
      }
    });
  }, [metadata.data?.ratingKey, metadata.data]);

  const duration = useMemo(
    () =>
      metadata.data?.duration &&
      (metadata.data?.type === "episode" || metadata.data?.type === "movie")
        ? durationToText(metadata.data?.duration)
        : "",
    [metadata.data],
  );

  const watched = useMemo(() => {
    if (!metadata.data) return false;

    const meta = metadata.data;

    if (meta.type === "show" && meta.leafCount === meta?.viewedLeafCount) {
      return true;
    }

    return !!(meta.type === "movie" && meta.viewCount);
  }, [metadata.data]);

  const title = useMemo(() => {
    if (!metadata.data) return "";

    return <p className="font-bold text-5xl">{metadata.data.title}</p>;
  }, [metadata.data, pathname]);

  const episodeCount = useMemo(() => {
    if (!metadata.data) return "";
    let episode = metadata.data?.leafCount
      ? `${metadata.data?.leafCount} Episode${metadata.data?.leafCount > 1 ? "s" : ""}`
      : "";
    if (metadata.data.type === "episode") {
      episode = `Episode ${metadata.data.index}`;
    }

    return episode;
  }, [metadata.data]);

  const subtitle = useMemo(() => {
    if (!metadata.data) return null;

    let season: string | ReactNode =
      metadata.data?.childCount && metadata.data?.childCount > 1
        ? `${metadata.data?.childCount} Seasons`
        : "";
    if (metadata.data.type === "season" && metadata.data.parentTitle) {
      season = "";
    } else if (metadata.data.type === "episode" && metadata.data.parentTitle) {
      season = (
        <Link
          href={`${pathname}?mid=${metadata.data.parentRatingKey}`}
          className="hover:text-primary"
        >
          {metadata.data.parentTitle}
        </Link>
      );
    }

    return !season && !episodeCount ? null : (
      <p className="font-bold text-muted-foreground max-w-4xl line-clamp-3 flex flex-row items-center gap-4">
        {season && <span>{season}</span>}
        {episodeCount && <span>{episodeCount}</span>}
      </p>
    );
  }, [metadata.data, episodeCount, pathname]);

  // Effect to handle backdrop
  useEffect(() => {
    const fetchBackdrop = async () => {
      if (!metadata.data) return;
      if (metadata.data.art) {
        setBackdropUrl(null);
        return;
      }

      const backdrop = await getBackdropUrl(metadata.data as any);
      if (backdrop) {
        setBackdropUrl(backdrop);
      }
    };

    fetchBackdrop();
  }, [metadata.data]);

  return (
    <Dialog
      open={!!mid}
      onOpenChange={(open) => {
        if (!open) router.replace(pathname, { scroll: false });
      }}
    >
      <DialogContent className="w-full p-0 max-w-[min(1500px,calc(100%-2rem))] h-full max-h-[calc(100%-2rem)] overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Item metadata dialog</DialogTitle>
        </VisuallyHidden>
        {metadata.data && (
          <ScrollArea>
            <div className="max-w-full rounded-lg h-full overflow-auto relative">
              {(() => {
                console.log("logging art", metadata.data.art);
                console.log("logging thumb", metadata.data.thumb);
                return null; // Return null to avoid type error
              })()}
              {(metadata.data.art || metadata.data.thumb || backdropUrl) ? (
                <div className="absolute top-0 right-0 left-0 z-0 max-w-full">
                  {playing ? (
                    <ReactPlayer
                      url={preview!}
                      controls={false}
                      width="100%"
                      height="100%"
                      autoPlay={true}
                      playing={playing}
                      volume={MetaScreenPlayerMuted ? 0 : 0.5}
                      muted={MetaScreenPlayerMuted}
                      onEnded={() => setPlaying(false)}
                      pip={false}
                      config={{
                        file: {
                          attributes: { disablePictureInPicture: true },
                        },
                      }}
                    />
                  ) : (
                    <img
                      loading="lazy"
                      className="w-full"
                      src={backdropUrl || `${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                        {
                          width: 300 * 4,
                          height: 170 * 4,
                          url: `${(metadata.data.art || metadata.data.thumb)}?X-Plex-Token=${token}`,
                          minSize: 1,
                          upscale: 1,
                          "X-Plex-Token": token,
                        },
                      )}`}
                      alt="preview image"
                    />
                  )}
                  <div
                    className="absolute top-0 left-0 right-0 bottom-0"
                    style={{
                      background:
                        "linear-gradient(0, hsl(var(--background)), rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.1))",
                    }}
                  />
                  <div className="absolute top-0 right-0 m-4 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        router.replace(pathname, { scroll: false })
                      }
                      type="button"
                    >
                      <X />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setMetaScreenPlayerMuted(!MetaScreenPlayerMuted);
                      }}
                      type="button"
                    >
                      {MetaScreenPlayerMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="absolute top-0 right-0 m-4 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.replace(pathname, { scroll: false })}
                    type="button"
                  >
                    <X />
                  </Button>
                </div>
              )}
              <div className="relative md:mt-96 mt-56 z-50">
                <div className="px-20 pt-0 pb-20 flex flex-col gap-6">
                  <div className="flex flex-row gap-6 items-center justify-start">
                    {/* Content Poster */}
                    {/* <img
                      loading="lazy"
                      className="hidden [@media(min-width:1200px)]:block rounded w-[300px] h-[450px] object-cover"
                      src={`${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                        {
                          width: 300,
                          height: 450,
                          url: `${metadata.data.type === "episode" ? metadata.data.parentThumb || metadata.data.thumb : metadata.data.thumb}?X-Plex-Token=${token}`,
                          minSize: 1,
                          upscale: 1,
                          "X-Plex-Token": token,
                        },
                      )}`}
                      alt="element poster"
                    /> */}
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-row items-center justify-start gap-2">
                          <img
                            loading="lazy"
                            src="https://i.imgur.com/7MHdofK.png"
                            alt="plex icon"
                            width={20}
                            height={20}
                          />
                          <p className="text-plex text-lg font-bold drop-shadow-md uppercase tracking-wider">
                            {metadata.data.type}
                          </p>
                        </div>
                        {/* Title of the content */}
                        {(metadata.data.type !== "movie" && metadata.data.type !== "show") && title}
                        <div className="font-bold text-muted-foreground max-w-4xl flex flex-col gap-2">
                          {metadata.data.type === "episode" && (
                            <Link
                              href={`${pathname}?mid=${metadata.data.grandparentRatingKey}`}
                            >
                              <p className="font-bold [@media(min-width:1200px)]:line-clamp-2 hover:text-primary">
                                {metadata.data.grandparentTitle}
                              </p>
                            </Link>
                          )}
                          {metadata.data.type === "season" && (
                            <Link
                              href={`${pathname}?mid=${metadata.data.parentRatingKey}`}
                              className="hover:text-primary"
                            >
                              {metadata.data.parentTitle}
                            </Link>
                          )}
                          {/* Title IMAGE of the content */}
                          {(metadata.data.type === "movie" || metadata.data.type === "show") && (
                            <div>
                              {(metadata.data as any).Image && findClearLogo((metadata.data as any).Image) ? (
                                <img
                                  loading="lazy"
                                  style={{ height: 'auto' }}
                                  className="hidden [@media(min-width:1200px)]:block rounded w-[300px] h-[450px] object-cover"
                                  src={`${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                                    {
                                      width: 300,
                                      height: 450,
                                      url: `${findClearLogo((metadata.data as any).Image)?.url}?X-Plex-Token=${token}`,
                                      minSize: 1,
                                      "X-Plex-Token": token,
                                    },
                                  )}`}
                                  alt="movie logo"
                                />
                              ) : (
                                <p className="font-bold text-5xl">{metadata.data.title}</p>
                              )}
                            </div>
                          )}

                          {subtitle}
                        </div>
                        {(metadata.data?.contentRating ||
                          metadata.data.year ||
                          duration) && (
                          <p className="font-bold text-muted-foreground max-w-4xl line-clamp-3 flex flex-row items-center gap-4">
                            {metadata.data?.contentRating && (
                              <span className="border-2 border-muted-foreground rounded-sm px-1 py-0.5 font-bold text-sm">
                                {metadata.data?.contentRating}
                              </span>
                            )}
                            {metadata.data.year && (
                              <span>{metadata.data.year}</span>
                            )}
                            {duration && <span>{duration}</span>}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-row items-center gap-4">
                        <Button
                          variant="plex"
                          size="lg"
                          onClick={() => {
                            if (metadata.data?.type === "movie") {
                              router.push(
                                `${pathname}?watch=${metadata.data.ratingKey}${metadata.data.viewOffset ? `&t=${metadata.data.viewOffset}` : ""}`,
                                { scroll: false },
                              );
                              return;
                            }

                            if (metadata.data?.type === "episode") {
                              router.push(
                                `${pathname}?watch=${metadata.data.ratingKey.toString()}${metadata.data.viewOffset ? `&t=${metadata.data.viewOffset}` : ""}`,
                                { scroll: false },
                              );
                              return;
                            }

                            if (
                              metadata.data?.type === "show" ||
                              metadata.data?.type === "season"
                            ) {
                              if (
                                metadata.data.OnDeck &&
                                metadata.data.OnDeck.Metadata
                              ) {
                                router.push(
                                  `${pathname}?watch=${metadata.data.OnDeck.Metadata.ratingKey}${
                                    metadata.data.OnDeck.Metadata.viewOffset
                                      ? `&t=${metadata.data.OnDeck.Metadata.viewOffset}`
                                      : ""
                                  }`,
                                  { scroll: false },
                                );
                                return;
                              }

                              const season =
                                metadata.data.type === "season"
                                  ? metadata.data
                                  : metadata.data?.Children?.Metadata.find(
                                      (s) => s.title !== "Specials",
                                    );
                              if (!season) return;

                              ServerApi.children({
                                id: season.ratingKey as string,
                              }).then((eps) => {
                                if (!eps) return;

                                router.push(
                                  `${pathname}?watch=${eps[0].ratingKey}`,
                                  { scroll: false },
                                );
                                return;
                              });
                            }
                          }}
                        >
                          <Play fill="currentColor" /> Play{" "}
                          {(metadata.data.type === "show" ||
                            metadata.data?.type === "season") &&
                            metadata.data.OnDeck &&
                            metadata.data.OnDeck?.Metadata &&
                            `${
                              metadata.data?.Children?.size &&
                              metadata.data.Children.size > 0
                                ? `S${metadata.data.OnDeck.Metadata.parentIndex}`
                                : ""
                            }
                              E${metadata.data.OnDeck.Metadata.index}`}
                        </Button>
                        {watched && (
                          <p className="text-plex uppercase flex flex-row items-center gap-2 font-bold">
                            <CircleCheck />
                            <span>watched</span>
                          </p>
                        )}
                      </div>
                      <p className="font-bold text-muted-foreground max-w-4xl line-clamp-3">
                        {metadata.data.summary}
                      </p>
                      <div>
                        {metadata.data.Genre &&
                          metadata.data.Genre.length > 0 && (
                            <div className="font-bold line-clamp-1">
                              <span className="text-muted-foreground pr-4">
                                Genre
                              </span>
                              {metadata.data.Genre.map((genre, i, arr) => (
                                <span key={genre.tag}>
                                  {genre.tag}
                                  {i !== arr.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        {languages && languages.length > 0 && (
                          <div className="font-bold line-clamp-2">
                            <span className="text-muted-foreground pr-4">
                              Audio
                            </span>
                            {languages?.map((lang, i, arr) => (
                              <span key={lang}>
                                {lang}
                                {i !== arr.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                        {subtitles && subtitles.length > 0 && (
                          <div className="font-bold line-clamp-2">
                            <span className="text-muted-foreground pr-4">
                              Subtitle
                            </span>
                            {subtitles?.map((lang, i, arr) => (
                              <span key={lang}>
                                {lang}
                                {i !== arr.length - 1 ? ", " : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {metadata.data.type === "show" && (
                    <div className="flex flex-col gap-6">
                      <p className="text-2xl font-bold">
                        {metadata.data.Children?.Metadata.length} Seasons
                      </p>
                      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {metadata.data.Children?.Metadata.map((season, i) => (
                          <SeasonView season={season} key={i} />
                        ))}
                      </div>
                    </div>
                  )}
                  {metadata.data.type === "season" && (
                    <div className="flex flex-col gap-6">
                      <p className="text-2xl font-bold">{episodeCount}</p>
                      {!episodes && (
                        <div className="flex flex-col w-fu;;">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className="flex flex-row items-center p-4 group transition hover:bg-secondary w-full border-b-2 justify-start text-left"
                            >
                              <Skeleton className="w-[8px] h-[28px] mr-4" />
                              <div className="pr-4 min-w-[150px] w-[150px] sm:min-w-[200px] sm:w-[200px] md:min-w-[250px] md:w-[250px] relative">
                                <Skeleton className="aspect-video w-full" />
                              </div>
                              <div className="w-full">
                                <Skeleton className="w-full sm:w-[200px] h-[22px] mb-1" />
                                <Skeleton className="h-[22px] w-full" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {episodes && (
                        <div className="flex flex-col w-full">
                          {episodes.value.map((item, i) => (
                            <EpisodeView
                              key={i}
                              count={episodes.count}
                              item={{
                                ...item,
                                image: `${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                                  {
                                    width: 16 * 20,
                                    height: 9 * 20,
                                    url: `${item.thumb}?X-Plex-Token=${token}`,
                                    minSize: 1,
                                    upscale: 1,
                                    "X-Plex-Token": token,
                                  },
                                )}`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {related.status === "pending" ? (
                    <div className="flex flex-col gap-6">
                      <Skeleton className="w-[200px] h-[24px]" />
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="aspect-video" />
                        ))}
                      </div>
                    </div>
                  ) : (
                    related.data &&
                    related.data.map((hub, i) => (
                      <div
                        key={`${hub.title}-${i}`}
                        className="flex flex-col gap-6"
                      >
                        <button
                          type="button"
                          className="text-left group w-full flex flex-row items-center gap-2"
                          onClick={() => {
                            console.log(hub);
                            router.push(
                              `${pathname}?${qs.stringify({ key: hub.key, libtitle: hub.title })}`,
                              {
                                scroll: false,
                              },
                            );
                          }}
                        >
                          <p className="font-bold text-2xl">{hub.title}</p>
                          <div className="group-hover:opacity-100 group-hover:translate-x-0 opacity-0 transition duration-150 -translate-x-full">
                            <ChevronRight className="h-6 w-6 text-plex" />
                          </div>
                        </button>
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {hub.Metadata.slice(0, 15).map((item, i) => (
                            <VideoView
                              key={i}
                              item={{
                                ...item,
                                contentRating: item.contentRating ?? "",
                                image: `${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                                  {
                                    width: 300 * 2,
                                    height: 170 * 2,
                                    url: `${item.art}?X-Plex-Token=${token}`,
                                    minSize: 1,
                                    upscale: 1,
                                    "X-Plex-Token": token,
                                  },
                                )}`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
