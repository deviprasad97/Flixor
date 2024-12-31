import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon, X } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ServerApi } from "@/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import qs from "qs";
import { usePathname, useRouter } from "next/navigation";

export const Search = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Plex.Metadata[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  const handleReset = () => {
    setResults([]);
    setQuery("");
  };

  const handleOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === "function") {
      setOpen((prev) => {
        const state = value(prev);
        if (!state) handleReset();
        return state;
      });
    } else {
      setOpen(value);
      if (!value) handleReset();
    }
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);

    ServerApi.search({ query: value }).then((res) => {
      if (!res) {
        setResults([]);
        return;
      }

      const valid = res.filter(
        (item) =>
          item.Metadata &&
          (item.Metadata.type === "movie" ||
            item.Metadata.type === "show" ||
            item.Metadata.type === "episode"),
      );
      const ordered = valid.toSorted((a, b) => b.score - a.score);
      const mapped = ordered.map((item) => item.Metadata);
      const present = mapped.filter((elem) => elem !== undefined);
      setResults(present);
    });
  };

  const token = localStorage.getItem("token");

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <SearchIcon /> Search libraries...{" "}
          <kbd className="group-hover:text-primary transition pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 rounded max-w-[min(32rem,calc(100%-2rem))]">
        <VisuallyHidden>
          <DialogTitle>Search dialog</DialogTitle>
        </VisuallyHidden>

        <div>
          <div className="flex flex-row items-center px-3 border-b">
            <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search..."
              onChange={({ target: { value } }) => handleSearch(value)}
              value={query}
            />
          </div>

          {results.length > 0 ? (
            <ScrollArea className="flex flex-col gap-2 px-3 py-2 max-h-[600px]">
              {results.map((item, i) => (
                <button
                  key={`${item.key}-${i}`}
                  className={`rounded flex w-full flex-row gap-2 justify-start text-left items-center p-2 hover:bg-accent hover:text-accent-foreground`}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(
                      `${pathname}?mid=${item.ratingKey.toString()}`,
                      { scroll: false },
                    );
                    handleReset();
                    setOpen(false);
                  }}
                >
                  <img
                    loading="lazy"
                    width={60}
                    height={90}
                    src={`${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                      {
                        width: 60,
                        height: 90,
                        url: `${(item.type === "episode" ? item.parentThumb : item.thumb) || item.thumb}?X-Plex-Token=${token}`,
                        minSize: 1,
                        upscale: 1,
                        "X-Plex-Token": token,
                      },
                    )}`}
                    alt="search result poster"
                    className="w-[60px] h-[90px] rounded"
                  />
                  <div>
                    <p className="line-clamp-1 font-bold">{item.title}</p>
                    {item.type === "episode" && (
                      <>
                        <p className="line-clamp-1 text-muted-foreground font-bold text-sm">
                          {item.grandparentTitle}
                        </p>
                        {item.parentIndex !== undefined &&
                        item.index !== undefined ? (
                          <p className="line-clamp-1 font-bold text-sm text-muted-foreground">
                            S{item.parentIndex.toString().padStart(2, "0")}
                            {" • "}
                            {item.index.toString().padStart(2, "0")}
                            {" • "}Episode
                          </p>
                        ) : (
                          <p className="line-clamp-1 font-bold text-sm text-muted-foreground">
                            episode
                          </p>
                        )}
                      </>
                    )}
                    {item.type !== "episode" && (
                      <p className="line-clamp-1 font-bold capitalize text-sm text-muted-foreground">
                        {item.type}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </ScrollArea>
          ) : (
            <div className="py-6 px-2 text-center text-sm">
              No results found.
            </div>
          )}
        </div>

        <DialogClose className="absolute right-4 top-3">
          <button
            type="button"
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};
