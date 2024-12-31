import { FC } from "react";
import qs from "qs";
import { usePathname, useRouter } from "next/navigation";

export const CollectionView: FC<{
  collection: Plex.Metadata & { image: string };
}> = ({ collection }) => {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button
      className="relative text-left rounded group"
      onClick={() => {
        router.push(
          `${pathname}?${qs.stringify({ key: collection.key, libtitle: `${collection.title} Collection`, full: "true" })}`,
          {
            scroll: false,
          },
        );
      }}
    >
      <img
        loading="lazy"
        className="w-full object-cover aspect-[8/12] top-0 rounded"
        src={collection.image}
        alt="poster"
      />
      <div className="p-4">
        <p className="font-bold w-full truncate">{collection.title}</p>
        {collection.childCount && (
          <p className="font-bold w-full text-muted-foreground truncate">
            {collection.childCount} Item{collection.childCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </button>
  );
};
