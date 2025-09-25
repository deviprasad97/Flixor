import { useState, useEffect } from 'react';
import { traktTrending, traktPopular, isTraktAuthenticated, ensureValidToken, traktGetWatchlist, traktGetRecommendations, traktGetHistory } from '@/services/trakt';
import { MediaCard } from './MediaCard';

interface TraktSectionProps {
  type?: 'trending' | 'popular' | 'watchlist' | 'recommendations' | 'history';
  mediaType?: 'movies' | 'shows';
  title?: string;
}

export function TraktSection({ type = 'trending', mediaType = 'movies', title }: TraktSectionProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadContent();

    // Listen for auth changes
    const handleAuthChange = () => {
      loadContent();
    };
    window.addEventListener('trakt-auth-changed', handleAuthChange);
    return () => window.removeEventListener('trakt-auth-changed', handleAuthChange);
  }, [type, mediaType]);

  const loadContent = async () => {
    try {
      setLoading(true);
      setError(null);

      const authenticated = isTraktAuthenticated();
      setIsAuthenticated(authenticated);

      let data: any[] = [];

      if (type === 'trending') {
        data = await traktTrending(mediaType, 20);
      } else if (type === 'popular') {
        data = await traktPopular(mediaType, 20);
      } else if (authenticated) {
        const token = await ensureValidToken();
        if (!token) {
          setError('Not authenticated with Trakt');
          return;
        }

        if (type === 'watchlist') {
          data = await traktGetWatchlist(token, mediaType);
        } else if (type === 'recommendations') {
          data = await traktGetRecommendations(token, mediaType, 20);
        } else if (type === 'history') {
          data = await traktGetHistory(token, mediaType, 20);
        }
      }

      setItems(data);
    } catch (err: any) {
      console.error('Failed to load Trakt content:', err);
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const getSectionTitle = () => {
    if (title) return title;

    const mediaLabel = mediaType === 'movies' ? 'Movies' : 'TV Shows';

    switch (type) {
      case 'trending':
        return `Trending ${mediaLabel} on Trakt`;
      case 'popular':
        return `Popular ${mediaLabel} on Trakt`;
      case 'watchlist':
        return `Your Trakt Watchlist`;
      case 'recommendations':
        return `Recommended for You`;
      case 'history':
        return `Recently Watched`;
      default:
        return `Trakt ${mediaLabel}`;
    }
  };

  const formatTraktItem = (item: any) => {
    const media = item.movie || item.show || item;
    const watched_at = item.watched_at;
    const progress = item.progress;

    // Extract the media object (could be nested in different ways)
    const title = media.title;
    const year = media.year;
    const ids = media.ids || {};

    // Build poster URL using TMDB ID if available
    let posterUrl = '';
    if (ids.tmdb) {
      const posterType = item.movie ? 'movie' : 'tv';
      posterUrl = `https://image.tmdb.org/t/p/w342/${posterType}/${ids.tmdb}/poster.jpg`;
    }

    return {
      id: ids.trakt || ids.slug,
      title,
      year,
      posterUrl,
      overview: media.overview,
      rating: media.rating,
      type: item.movie ? 'movie' : 'show',
      ids,
      watched_at,
      progress,
      runtime: media.runtime,
      genres: media.genres,
      certification: media.certification
    };
  };

  if (!isAuthenticated && (type === 'watchlist' || type === 'recommendations' || type === 'history')) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">{getSectionTitle()}</h2>
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">Connect your Trakt account to see this content</p>
          <button
            onClick={() => window.location.href = '/settings'}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Connect Trakt Account
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">{getSectionTitle()}</h2>
        <div className="flex space-x-4 overflow-x-auto pb-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-48">
              <div className="bg-gray-800 rounded-lg aspect-[2/3] animate-pulse"></div>
              <div className="mt-2 h-4 bg-gray-800 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">{getSectionTitle()}</h2>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">{getSectionTitle()}</h2>
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">No items found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">{getSectionTitle()}</h2>
      <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
        {items.map((item, index) => {
          const formatted = formatTraktItem(item);
          return (
            <div key={`${formatted.id}-${index}`} className="flex-shrink-0 w-48">
              <MediaCard
                title={formatted.title}
                year={formatted.year}
                posterUrl={formatted.posterUrl}
                onClick={() => {
                  // TODO: Navigate to details page with Trakt data
                  console.log('Clicked Trakt item:', formatted);
                }}
              />
              {formatted.progress && (
                <div className="mt-1 h-1 bg-gray-700 rounded">
                  <div
                    className="h-full bg-green-600 rounded"
                    style={{ width: `${formatted.progress}%` }}
                  />
                </div>
              )}
              {formatted.watched_at && (
                <p className="text-xs text-gray-500 mt-1">
                  Watched {new Date(formatted.watched_at).toLocaleDateString()}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}