"use client";

import { ServerApi } from "@/api";
import { useEffect, useState } from "react";
import { Hero } from "@/components/hero";
import _ from "lodash";
import { HubSlider } from "@/components/hub-slider";
import { useLibraries } from "@/components/auth-provider";

export default function Home() {
  const [item, setItem] = useState<Plex.Metadata | null>(null);
  const [continueWatching, setContinueWatched] = useState<Plex.Hub | null>(
    null,
  );
  const [promoted, setPromoted] = useState<Plex.Hub[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { libraries } = useLibraries();

  const updateContinueWatching = () => {
    const dirs = libraries.map((a) => a.key);
    ServerApi.continue({ dirs }).then((res) => {
      if (!res) return;
      if (res.length === 0) return;
      setContinueWatched(res[0]);
    });
  };

  const updatePromoted = async () => {
    const dirs = libraries.map((a) => a.key);
    const promo: Plex.Hub[] = [];
    for (const dir of dirs) {
      const res = await ServerApi.promoted({ dir, dirs });
      if (!res) continue;
      if (res.length === 0) continue;
      res.forEach((hub) => {
        promo.push(hub);
      });
    }
    setPromoted(promo);
  };

  useEffect(() => {
    setIsLoading(true);
    const dirs = libraries.map((a) => a.key);
    console.log("dirs", dirs);
    (async () => {
      if (dirs.length > 0) {
        const item = await ServerApi.random({ dir: dirs });
        setItem(item);
      }
      ServerApi.continue({ dirs }).then((res) => {
        if (!res) return;
        if (res.length === 0) return;
        setContinueWatched(res[0]);
        console.log(res)
      });
      const promo: Plex.Hub[] = [];
      for (const dir of dirs) {
        const res = await ServerApi.promoted({ dir, dirs });
        if (!res) continue;
        if (res.length === 0) continue;
        res.forEach((hub) => {
          promo.push(hub);
        });
        console.log("In For Loop")
        console.log(dir, res)
      }
      setPromoted(promo);
      setIsLoading(false);
    })();

    window.addEventListener("popstate", updateContinueWatching);
    return () => {
      window.removeEventListener("popstate", updateContinueWatching);
    };
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-start justify-start">
      {item ? <Hero item={item} /> : <div className="h-16" />}
      <div
        className={`flex flex-col items-start justify-start w-full z-10 ${item ? "-mt-20" : "mt-16"}`}
      >
        {continueWatching && (
          <HubSlider onUpdate={updateContinueWatching} hub={continueWatching} />
        )}
        {promoted &&
          promoted.map((item, i) => (
            <HubSlider
              onUpdate={updatePromoted}
              key={`${item.key}-${i}`}
              hub={item}
            />
          ))}
      </div>
    </div>
  );
}
