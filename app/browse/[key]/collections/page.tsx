"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ServerApi } from "@/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEffect, useState } from "react";
import { CollectionView } from "@/components/cards/collection-view";
import qs from "qs";

type SelectedType = "recommended" | "library" | "collections" ;

export default function Page() {
  const params = useParams<{ key: string }>();
  const router = useRouter();
  const library = useQuery({
    queryKey: ["details", params.key],
    queryFn: async () => {
      return await ServerApi.details({ key: params.key, include: true });
    },
  });

  const [collections, setCollections] = useState<Plex.Metadata[]>([]);

  useEffect(() => {
    setCollections([]);

    ServerApi.collections({
      id: params.key,
    }).then((res) => {
      if (!res) return;
      if (res.length === 0) return;
      setCollections(res);
      console.log(res);
    });
  }, [params.key]);

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
            <p className="font-bold text-5xl">Collections</p>
            {collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4">
                <p className="text-2xl text-gray-500">No collections found 😔</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {collections.map((item, i) => (
                  <CollectionView
                    key={i}
                    collection={{
                      ...item,
                      contentRating: item.contentRating ?? "",
                      image: `${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                        {
                          width: 300 * 2,
                          height: 170 * 2,
                          url: `${item.thumb}&X-Plex-Token=${token}`,
                          minSize: 1,
                          upscale: 1,
                          "X-Plex-Token": token,
                        }
                      )}`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="absolute right-0 top-16 p-4">
          <ToggleGroup
            type="single"
            value="collections"
            onValueChange={(value: SelectedType) => {
              if (value === "recommended") {
                router.push(`/browse/${params.key}`);
              } else if (value === "library") {
                router.push(`/browse/${params.key}/library`);
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
              variant="outline">
            Collections
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </>
    );
  }

  return null;
}
