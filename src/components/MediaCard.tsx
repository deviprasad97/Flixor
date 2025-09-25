interface MediaCardProps {
  title: string;
  year?: number;
  posterUrl?: string;
  onClick?: () => void;
}

export function MediaCard({ title, year, posterUrl, onClick }: MediaCardProps) {
  return (
    <div
      className="cursor-pointer group"
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              // Fallback to placeholder if image fails to load
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"%3E%3Crect fill="%23374151" width="200" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="sans-serif" font-size="20"%3ENo Image%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <span className="text-gray-500">No Image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <div className="mt-2">
        <h3 className="text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
        {year && (
          <p className="text-xs text-gray-500">{year}</p>
        )}
      </div>
    </div>
  );
}