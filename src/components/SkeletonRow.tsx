export default function SkeletonRow({ count = 8 }: { count?: number }) {
  return (
    <div className="px-4 md:px-6 lg:px-10 py-4">
      <div className="h-5 w-40 skeleton rounded mb-3" />
      <div className="flex gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-40 aspect-[2/3] rounded-md overflow-hidden bg-neutral-800 skeleton" />
        ))}
      </div>
    </div>
  );
}

