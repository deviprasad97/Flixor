"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ServerApi } from "@/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCallback, useEffect, useRef, useState } from "react";
import { CollectionView } from "@/components/cards/collection-view";
import qs from "qs";
import { VideoView } from "@/components/cards/video-view";
import { LoaderCircle } from "lucide-react";
import { Canceler } from "axios";
import { getBackdropUrl } from "@/lib/utils";
import "./library.scss";

// Helper function to extract IMDB ID from Guid array
const findImdbId = (guid?: Array<{ id: string }>): string | undefined => {
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
    const data = await response.json() as { movie_results?: Array<{ backdrop_path?: string }>; tv_results?: Array<{ backdrop_path?: string }> };
    const backdropPath = data.movie_results?.[0]?.backdrop_path || data.tv_results?.[0]?.backdrop_path;
    return backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : undefined;
  } catch (error) {
    console.error('Error fetching TMDB backdrop:', error);
    return undefined;
  }
};

type SelectedType = "recommended" | "collections" | "library";

export default function Page() {
  const params = useParams<{ key: string }>();
  const router = useRouter();
  const library = useQuery({
    queryKey: ["details", params.key],
    queryFn: async () => {
      return await ServerApi.details({ key: params.key, include: true });
    },
  });

  const [results, setResults] = useState<Plex.Metadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [page, setPage] = useState(0);

  const observer = useRef<IntersectionObserver>();
  const lastRef = useCallback(
    (node: HTMLButtonElement) => {
      if (loading || !hasMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => p + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  useEffect(() => {
    // Reset state when `params.key` changes
    setResults([]);
    setHasMore(true);
    setPage(0);
  }, [params.key]);

  useEffect(() => {
    if (!hasMore) {
      console.log("safdgfsd");
      return;
    }
    setLoading(true);

    let cancel: Canceler;
    ServerApi.all({
      id: params.key,
      start: results.length,
      size: 100,
      canceler: (c) => {
        cancel = c;
      },
    }).then((res) => {
      console.log(res);
      if (res) {
        if (res.results.length + results.length >= res.total) {
          setHasMore(false);
        }
        setResults((prev) => [...prev, ...res.results]);
      }
      setLoading(false);
    });

    return () => {
      if (cancel) {
        cancel();
        setLoading(false);
      }
    };
  }, [page, params.key]);

  const [backdrops, setBackdrops] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchBackdrops = async () => {
      const newBackdrops: Record<string, string> = {};
      
      for (const item of results) {
        console.log("fwegfewr:", item);

        if (!item.art) {
          console.log("no art:", item);
          const backdrop = await getBackdropUrl(item as any);
          console.log("backdrop:", backdrop);
          if (backdrop) {
            newBackdrops[item.ratingKey] = backdrop;
          }
        }
      }
      
      setBackdrops(prev => ({ ...prev, ...newBackdrops }));
    };

    fetchBackdrops();
  }, [results]);

  if (!library.data) {
    return null;
  }

  const type = library.data.Type[0].type;

  if (type === "show" || type === "movie") {
    const token = localStorage.getItem("token");
    return (
      <>
        <div className="w-full absolute top-16">
          <div className="max-w-screen-2xl p-20 mx-auto flex flex-col gap-10">
            <p className="font-bold text-5xl">Library</p>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 library-grid">
              {results.map((item, i) =>
                i === results.length - 1 ? (
                  <div className="library-grid__item" key={i}>
                    <VideoView
                      ref={lastRef}
                      item={{
                        ...item,
                        contentRating: item.contentRating ?? "",
                        image: backdrops[item.ratingKey] || `${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                          {
                            width: 300 * 2,
                            height: 170 * 2,
                            url: `${item.art || item.Image?.[0]?.url}?X-Plex-Token=${token}`,
                            minSize: 1,
                            upscale: 1,
                            "X-Plex-Token": token,
                          },
                        )}`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="library-grid__item" key={i}>
                    <VideoView
                      item={{
                        ...item,
                        contentRating: item.contentRating ?? "",
                        image: backdrops[item.ratingKey] || `${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                          {
                            width: 300 * 2,
                            height: 170 * 2,
                            url: `${item.art || item.Image?.[0]?.url}?X-Plex-Token=${token}`,
                            minSize: 1,
                            upscale: 1,
                            "X-Plex-Token": token,
                          },
                        )}`,
                      }}
                    />
                  </div>
                ),
              )}
            </div>
            {loading && (
              <LoaderCircle className="w-20 h-20 animate-spin text-plex mx-auto" />
            )}
          </div>
        </div>
        <div className="absolute right-0 top-16 p-4">
          <ToggleGroup
            type="single"
            value="library"
            onValueChange={(value: SelectedType) => {
              if (value === "recommended") {
                router.push(`/browse/${params.key}`);
              } else if (value === "collections") {
                router.push(`/browse/${params.key}/collections`);
              }
            }}
          >
            <ToggleGroupItem
              value="recommended"
              aria-label="Recommended"
              variant="outline"
            >
              Recommended
            </ToggleGroupItem>
            <ToggleGroupItem
              value="library"
              aria-label="Library"
              variant="outline"
            >
              Library
            </ToggleGroupItem>
            <ToggleGroupItem
              value="collections"
              aria-label="Collections"
              variant="outline"
            >
              Collections
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </>
    );
  }

  return null;
}
