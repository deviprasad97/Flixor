import { FC } from "react";
import { durationToText } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { usePathname, useRouter } from "next/navigation";
import { Play } from "lucide-react";

export const EpisodeView: FC<{
  item: Plex.Metadata & { image: string };
  count: number;
}> = ({ item, count }) => {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        const mid = item.ratingKey.toString();
        router.push(`${pathname}?watch=${mid}`, { scroll: false });
      }}
      className="flex flex-row items-center p-4 group transition hover:bg-secondary w-full border-b-2 justify-start text-left"
    >
      <p
        className={`mr-4 text-xl font-bold`}
        style={{ minWidth: `${count}ch` }}
      >
        {item.index}
      </p>
      <div className="mr-4 hidden sm:block sm:min-w-[200px] sm:w-[200px] md:min-w-[250px] md:w-[250px] relative">
        <img
          loading="lazy"
          className="rounded aspect-video object-cover w-full"
          src={item.image}
          alt="episode preview image"
        />
        {(item.viewOffset || (item.viewCount && item.viewCount >= 1)) && (
          <Progress
            className="absolute rounded-t-none rounded-b bottom-0 left-0 h-[4px]"
            value={
              item.viewOffset
                ? Math.floor((item.viewOffset / item.duration) * 100)
                : 100
            }
          />
        )}
        <div className="absolute inset-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition">
          <Play fill="currentColor" />
        </div>
      </div>
      <div className="w-full">
        <p className="font-bold flex flex-row justify-between gap-4">
          <span className="line-clamp-1 sm:line-clamp-2 md:line-clamp-3">
            {item.title}
          </span>
          <span>{durationToText(item.duration)}</span>
        </p>
        <p className="line-clamp-2">{item.summary}</p>
      </div>
    </button>
  );
};
