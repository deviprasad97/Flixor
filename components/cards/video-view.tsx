import { FC, forwardRef, RefObject, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { VideoItemInterface } from "@/type";
import { Progress } from "@/components/ui/progress";
import { ServerApi } from "@/api";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Circle, CircleCheck, ChevronDown, Info, Pencil, Play } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button"


export const VideoView = forwardRef<
  HTMLButtonElement,
  {
    item: VideoItemInterface;
  }
>(({ item }, ref) => {
  const router = useRouter();
  const pathname = usePathname();
  const [viewCount, setViewCount] = useState(item.viewCount);

  const mid = item.ratingKey.toString();

  const title = useMemo(() => {
    if (item.type === "movie" || item.type === "show") {
      return item.title;
    }

    if (item.type === "season") {
      return item.parentTitle ?? item.title;
    }

    if (item.type === "episode") {
      return item.grandparentTitle ?? item.parentTitle ?? item.title;
    }

    return item.title;
  }, [item]);

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
          : item.Children?.Metadata.find((s) => s.title !== "Specials");
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          ref={ref}
          className="group rounded w-full h-full flex flex-col hover:outline outline-plex"
          type="button"
        >
        <div 
            className="relative aspect-video w-full flex flex-col rounded-t group"
            style={{
              background: `url(${item.image}) center center / cover no-repeat`,
             }}
            onClick={(e) => {
              e.preventDefault();
              if (item.type === "episode" || item.type === "movie") {
                handlePlay();
              } else {
                router.push(`${pathname}?mid=${mid}`, { scroll: false });
              }
            }}>
            {(item.type === "episode" || item.type === "movie") && <button
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              onClick={(e) => {
                if (item.type === "episode" || item.type === "movie") {
                  e.stopPropagation();
                  handlePlay();
                }
              }}
            >
              <Play className="w-10 h-10" fill="currentColor"/>
            </button>}
            {(item.type === "episode" || item.type === "movie") &&
              (item.viewOffset || (item.viewCount && item.viewCount >= 1)) && (
                <Progress
                  className="absolute rounded-t-none rounded-b bottom-0 left-0 h-[4px]"
                  value={
                    item.viewOffset
                      ? Math.floor((item.viewOffset / item.duration) * 100)
                      : 100
                  }
                />
              )}
          </div>
          <div className="bg-secondary/40 rounded-b w-full p-4 text-left text-muted-foreground font-semibold flex-1 flex flex-col gap-1.5">
            <p className="uppercase text-sm text-plex font-semibold flex flex-row items-center gap-2">
              <span>
                {item.type} {item.type === "season" && item.index}
                {item.type === "episode" && item.index}
              </span>
              <span className="flex-1" />
              <span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button className="rounded-full p-0 w-10 h-10 
                                         flex items-center justify-center 
                                         border border-transparent hover:border-white 
                                         hover:ring-0 transition duration-200"
                              onClick={(e) => {
                                e.preventDefault();
                                router.push(`${pathname}?mid=${mid}`, {
                                  scroll: false,
                                });
                              }}>
                      <ChevronDown className="w-8 h-8" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    More Info
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              </span>
            </p>
            <p className="font-semibold truncate lg:text-lg text-normal">
              {title}
            </p>
            {item.type === "episode" && (
              <>
                <p className="text-xs">Season {item.parentIndex}</p>
                <p className="text-sm">{item.title}</p>
              </>
            )}
            {item.type === "season" && item.leafCount !== undefined && (
              <p className="text-xs">
                {item.leafCount} Episode{item.leafCount > 0 ? "s" : ""}
              </p>
            )}
            <p className="line-clamp-6 text-sm sm:text-md">{item.summary}</p>
            <div className="flex-1" />
            {(item.contentRating || item.year) && (
              <p className="w-full max-w-full font-semibold t-sm truncate text-md text-muted-foreground flex flex-row items-center gap-2">
                {item.contentRating && (
                  <span className="border border-muted-foreground rounded-sm px-1 font-bold text-sm">
                    {item.contentRating}
                  </span>
                )}
                <span className="flex-1" />
                <span>{item.year}</span>
              </p>
            )}
          </div>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuLabel className="truncate w-full overflow-hidden">
          {(item.type === "season" ? item.parentTitle : item.title) ??
            item.title}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem className="flex flex-row gap-2" asChild>
          <button type="button" onClick={handlePlay} className="w-full">
            <Play fill="currentColor" className="w-4 h-4" />
            <span>Play</span>
          </button>
        </ContextMenuItem>
        <ContextMenuItem className="flex flex-row gap-2" asChild disabled={viewCount !== undefined && viewCount > 0}>
          <button
            type="button"
            className="w-full"
            onClick={() => {
              ServerApi.scrobble({ key: mid }).then((success) => {
                if (success) {
                  const newCount = viewCount ? viewCount + 1 : 1;
                  setViewCount(newCount);
                  item.viewCount = newCount;
                }
              });
            }}
          >
            <CircleCheck className="w-4 h-4" />
            <span>Mark as Watched</span>
          </button>
        </ContextMenuItem>
        <ContextMenuItem className="flex flex-row gap-2" asChild disabled={viewCount === undefined || viewCount === 0}>
          <button
            type="button"
            className="w-full"
            onClick={() => {
              ServerApi.unscrobble({ key: mid }).then((success) => {
                if (success) {
                  const newCount = viewCount ? viewCount - 1 : 0;
                  setViewCount(newCount);
                  item.viewCount = newCount;
                }
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
});
