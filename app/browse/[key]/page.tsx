"use client";

import { ServerApi } from "@/api";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEffect, useState } from "react";
import { Hero } from "@/components/hero";
import { HubSlider } from "@/components/hub-slider";

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
  const [featured, setFeatured] = useState<Plex.Metadata | null>(null);
  const [hubs, setHubs] = useState<Plex.Hub[]>([]);

  const updateHubs = () => {
    ServerApi.hubs({
      id: params.key,
    }).then((res) => {
      if (!res) return;
      if (res.length === 0) return;
      setHubs(res.filter((hub) => hub.Metadata && hub.Metadata.length > 0));
    });
  };

  useEffect(() => {
    setFeatured(null);
    setHubs([]);

    ServerApi.random({ dir: params.key }).then((res) => {
      if (!res) return;
      setFeatured(res);
    });

    ServerApi.hubs({
      id: params.key,
    }).then((res) => {
      if (!res) return;
      if (res.length === 0) return;
      setHubs(res.filter((hub) => hub.Metadata && hub.Metadata.length > 0));
    });
  }, [params.key]);

  useEffect(() => {
    window.addEventListener("popstate", updateHubs);
    return () => {
      window.removeEventListener("popstate", updateHubs);
    };
  }, []);

  if (!library.data) {
    return null;
  }

  const type = library.data.Type[0].type;

  if (type === "show" || type === "movie") {
    return (
      <>
        <div className="w-full flex flex-col items-start justify-start">
          {featured && <Hero item={featured} />}
          <div
            className={`flex flex-col items-start justify-start w-full z-10 ${featured ? "-mt-20" : "mt-36"}`}
          >
            {hubs.map((item, i) => (
              <HubSlider
                key={`${item.key}-${i}`}
                id={params.key}
                hub={item}
                onUpdate={() => updateHubs()}
              />
            ))}
          </div>
        </div>
        <div className="absolute right-0 top-16 p-4">
          <ToggleGroup
            type="single"
            value="recommended"
            onValueChange={(value: SelectedType) => {
              if (value === "collections") {
                router.push(`/browse/${params.key}/collections`);
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
