import { FC } from "react";
import { Slider } from "@/components/slider";
import qs from "qs";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

export const HubSlider: FC<{
  hub: Plex.Hub;
  onUpdate: () => void;
  id?: string | undefined;
}> = ({ id = undefined, hub, onUpdate }) => {
  const router = useRouter();
  const pathname = usePathname();
  const token = localStorage.getItem("token");

  return (
    <div className="w-[100%] overflow-x-hidden overflow-y-clip">
      <button
        type="button"
        className="text-left flex flex-row items-center mx-20 group w-full gap-2"
        onClick={() => {
          router.push(
            `${pathname}?${qs.stringify({ key: hub.key, libtitle: hub.title, ...(id ? { contentDirectoryID: id } : {}) })}`,
            {
              scroll: false,
            },
          );
        }}
      >
        <p className="font-bold text-xl md:text-2xl tracking-tight">
          <span className="px-[5px]">{hub.title}</span>
        </p>
        <div className="group-hover:opacity-100 group-hover:translate-x-0 opacity-0 transition duration-150 -translate-x-full">
          <ChevronRight className="h-6 w-6 text-plex" />
        </div>
      </button>
      {hub.Metadata && (
        <Slider
          onUpdate={onUpdate}
          items={hub.Metadata.map((item) => ({
            ...item,
            contentRating: item.contentRating ?? "",
            image:
              item.type === "episode"
                ? `${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                    {
                      width: 300 * 2,
                      height: 170 * 2,
                      url: `${item.thumb}?X-Plex-Token=${token}`,
                      minSize: 1,
                      upscale: 1,
                      "X-Plex-Token": token,
                    },
                  )}`
                : `${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                    {
                      width: 300 * 2,
                      height: 170 * 2,
                      url: `${item.art}?X-Plex-Token=${token}`,
                      minSize: 1,
                      upscale: 1,
                      "X-Plex-Token": token,
                    },
                  )}`,
          }))}
        />
      )}
    </div>
  );
};
