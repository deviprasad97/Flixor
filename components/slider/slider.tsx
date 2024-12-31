import { FC } from "react";
import { useSliding } from "@/components/slider/use-sliding";
import { useIsSize } from "@/hooks/use-is-size";
import {
  ChevronDown,
  Circle,
  CircleCheck,
  Info,
  Pencil,
  Play,
} from "lucide-react";
import { VideoItemInterface } from "@/type";
import { durationToText } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ServerApi } from "@/api";
import { Progress } from "@/components/ui/progress";

export const Slider: FC<{
  items: VideoItemInterface[];
  onUpdate: (item: VideoItemInterface) => void;
}> = ({ items, onUpdate }) => {
  const {
    handlePrev,
    handleNext,
    slideProps,
    containerRef,
    hasNext,
    hasPrev,
    elementRef,
  } = useSliding(items.length);
  const { isTiny, isMobile, isTablet, isDesktop } = useIsSize();
  const router = useRouter();
  const pathname = usePathname();

  const isFirst = (i: number) => {
    if (isTiny) return i % 2 === 0;
    if (isMobile) return i % 3 === 0;
    if (isTablet) return i % 4 === 0;
    if (isDesktop) return i % 5 === 0;
    return i % 6 === 0;
  };

  const isLast = (i: number) => {
    if (isTiny) return isFirst(i - 1);
    if (isMobile) return isFirst(i - 2);
    if (isTablet) return isFirst(i - 3);
    if (isDesktop) return isFirst(i - 4);
    return isFirst(i - 5);
  };

  return (
    <div className="pt-[20px] pb-[40px] overflow-visible relative slider__parent">
      <div className="slider">
        <div ref={containerRef} className="slider__container" {...slideProps}>
          {items.map((item, i) => {
            const watched =
              (item.type === "show" &&
                item.leafCount === item.viewedLeafCount) ||
              (item.type === "movie" && item?.viewCount && item.viewCount > 0);
            const seasons =
              item.childCount && item.childCount > 1
                ? `${item.childCount} Seasons`
                : "";
            const episodes = item.leafCount
              ? `${item.leafCount} Episode${item.leafCount > 1 ? "s" : ""}`
              : "";
            const duration =
              item.duration &&
              (item.type === "episode" || item.type === "movie")
                ? durationToText(item.duration)
                : "";
            const mid = item.ratingKey.toString();

            const handlePlay = () => {
              if (item.type === "movie") {
                router.push(
                  `${pathname}?watch=${item.ratingKey}${item.viewOffset ? `&t=${item.viewOffset}` : ""}`,
                  { scroll: false },
                );
                return;
              }

              if (item.type === "episode") {
                router.push(
                  `${pathname}?watch=${item.ratingKey.toString()}${item.viewOffset ? `&t=${item.viewOffset}` : ""}`,
                  { scroll: false },
                );
                return;
              }

              if (item.type === "show" || item.type === "season") {
                if (item.OnDeck && item.OnDeck.Metadata) {
                  router.push(
                    `${pathname}?watch=${item.OnDeck.Metadata.ratingKey}${
                      item.OnDeck.Metadata.viewOffset
                        ? `&t=${item.OnDeck.Metadata.viewOffset}`
                        : ""
                    }`,
                    { scroll: false },
                  );
                  return;
                }

                const season =
                  item.type === "season"
                    ? item
                    : item.Children?.Metadata.find(
                        (s) => s.title !== "Specials",
                      );
                console.log(season, item);
                if (!season) return;

                ServerApi.children({
                  id: season.ratingKey as string,
                }).then((eps) => {
                  if (!eps) return;

                  router.push(`${pathname}?watch=${eps[0].ratingKey}`, {
                    scroll: false,
                  });
                  return;
                });
              }
            };

            return (
              <ContextMenu key={i}>
                <ContextMenuTrigger asChild>
                  <div
                    className="item group overflow-x-hidden rounded relative h-full bg-[rgb(21,21,23)] flex flex-col"
                    {...{ "data-first": isFirst(i), "data-last": isLast(i) }}
                    ref={elementRef}
                  >
                    <button
                      style={{
                        background: `url(${item.image}) center center / cover no-repeat`,
                      }}
                      className="relative aspect-video w-full flex flex-col"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePlay();
                      }}
                    >
                      {watched && (
                        <div className="absolute top-0 px-4 pt-4 w-full max-w-full flex flex-row items-center justify-end gap-2">
                          <span className="lg:group-hover:opacity-100 opacity-0 font-bold uppercase duration-300 ease-in-out transition text-xs">
                            watched
                          </span>
                          <CircleCheck />
                        </div>
                      )}
                      <div className="flex-1"></div>
                      {(item.type === "episode" || item.type === "movie") &&
                        (item.viewOffset ||
                          (item.viewCount && item.viewCount >= 1)) && (
                          <Progress
                            className="absolute rounded-t-none rounded-b bottom-0 left-0 h-[4px]"
                            value={
                              item.viewOffset
                                ? Math.floor(
                                    (item.viewOffset / item.duration) * 100,
                                  )
                                : 100
                            }
                          />
                        )}
                    </button>
                    <button
                      className="p-4 w-full max-w-full flex-1 text-left flex flex-col gap-0.5"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(`${pathname}?mid=${mid}`, {
                          scroll: false,
                        });
                      }}
                    >
                      <p className="font-bold truncate sm:text-md text-sm text-plex flex flex-row items-center gap-2 uppercase">
                        {item.type}
                        {(item.type === "season" || item.type === "episode") &&
                          ` ${item.index}`}
                      </p>
                      <p className="font-bold line-clamp-1 lg:text-lg">
                        {(item.type === "season"
                          ? item.parentTitle
                          : item.title) ?? item.title}
                      </p>
                      {item.type === "episode" && item.grandparentTitle && (
                        <p className="font-bold text-sm text-muted-foreground line-clamp-1">
                          {item.grandparentTitle}
                        </p>
                      )}
                      <div className="flex-1"></div>
                      <p className="w-full max-w-full truncate text-sm text-muted-foreground flex flex-row items-center gap-2">
                        {(episodes || seasons) && (
                          <span className="font-bold">
                            {seasons || episodes}
                          </span>
                        )}
                        {duration && (
                          <span className="font-bold">{duration}</span>
                        )}
                        <span className="flex-1" />
                        <span className="text-xs font-bold">{item.year}</span>
                      </p>
                    </button>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-64">
                  <ContextMenuLabel className="truncate w-full overflow-hidden">
                    {(item.type === "season" ? item.parentTitle : item.title) ??
                      item.title}
                  </ContextMenuLabel>
                  <ContextMenuSeparator />
                  <ContextMenuItem className="flex flex-row gap-2" asChild>
                    <button
                      type="button"
                      onClick={handlePlay}
                      className="w-full"
                    >
                      <Play fill="currentColor" className="w-4 h-4" />
                      <span>Play</span>
                    </button>
                  </ContextMenuItem>
                  <ContextMenuItem className="flex flex-row gap-2" asChild>
                    <button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        ServerApi.scrobble({ key: mid }).then((success) => {
                          if (success) onUpdate(item);
                        });
                      }}
                    >
                      <CircleCheck className="w-4 h-4" />
                      <span>Mark as Watched</span>
                    </button>
                  </ContextMenuItem>
                  <ContextMenuItem className="flex flex-row gap-2" asChild>
                    <button
                      type="button"
                      className="w-full"
                      onClick={() => {
                        ServerApi.unscrobble({ key: mid }).then((success) => {
                          if (success) onUpdate(item);
                        });
                      }}
                    >
                      <Circle className="w-4 h-4" />
                      <span>Mark as Unwatched</span>
                    </button>
                  </ContextMenuItem>
                  <ContextMenuItem className="flex flex-row gap-2" asChild>
                    <button
                      type="button"
                      className="w-full"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(`${pathname}?mid=${mid}`, {
                          scroll: false,
                        });
                      }}
                    >
                      <Info className="w-4 h-4" />
                      <span>Info</span>
                    </button>
                  </ContextMenuItem>
                  <ContextMenuItem disabled className="flex flex-row gap-2">
                    <Pencil className="w-4 h-4" />
                    <span>Edit</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
      {hasPrev && (
        <button
          className={`slide-button slide-button--prev group`}
          onClick={handlePrev}
        >
          <span>
            <ChevronDown
              size={50}
              color={"#ffffff"}
              className="group-hover:scale-125 transition duration-200"
            />
          </span>
        </button>
      )}
      {hasNext && (
        <button
          className={`slide-button slide-button--next group`}
          onClick={handleNext}
        >
          <span>
            <ChevronDown
              size={50}
              color={"#ffffff"}
              className="group-hover:scale-125 transition duration-200"
            />
          </span>
        </button>
      )}
    </div>
  );
};
