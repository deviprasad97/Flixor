import { useEffect, useState } from 'react';
import { plexTvWatchlist, plexTvAddToWatchlist, plexTvRemoveFromWatchlist } from '@/services/plextv';
import { traktAddToWatchlist, traktRemoveFromWatchlist, getTraktTokens } from '@/services/trakt';

interface WatchlistButtonProps {
  itemId: string;
  itemType: 'movie' | 'show';
  tmdbId?: string | number;
  imdbId?: string;
  title?: string;
  year?: number;
  className?: string;
  variant?: 'icon' | 'button';
}

export default function WatchlistButton({
  itemId,
  itemType,
  tmdbId,
  imdbId,
  title,
  year,
  className = '',
  variant = 'icon'
}: WatchlistButtonProps) {
  const [isInList, setIsInList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkWatchlistStatus();
  }, [itemId]);

  async function checkWatchlistStatus() {
    setChecking(true);
    try {
      // Check Plex watchlist
      const watchlist = await plexTvWatchlist();
      const items = watchlist.MediaContainer?.Metadata || [];
      const normalizedId = String(itemId || '').startsWith('plex:') ? String(itemId).replace(/^plex:/,'') : String(itemId);
      const found = items.some((item: any) => {
        if (String(item.ratingKey) === normalizedId) return true;
        if (tmdbId && item.guid?.includes(`tmdb://${tmdbId}`)) return true;
        if (imdbId && item.guid?.includes(`imdb://${imdbId}`)) return true;
        return false;
      });
      setIsInList(found);
    } catch (err) {
      console.error('Failed to check watchlist status:', err);
    } finally {
      setChecking(false);
    }
  }

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (loading || checking) return;

    setLoading(true);
    try {
      if (isInList) {
        // Remove from watchlist
        await removeFromWatchlists();
        setIsInList(false);
      } else {
        // Add to watchlist
        await addToWatchlists();
        setIsInList(true);
      }
    } catch (err) {
      console.error('Failed to update watchlist:', err);
      // Revert on error
      setIsInList(!isInList);
    } finally {
      setLoading(false);
    }
  }

  async function addToWatchlists() {
    const promises: Promise<any>[] = [];

    // Add to Plex (prefer GUIDs)
    const plexGuid = tmdbId ? `tmdb://${typeof tmdbId === 'string' ? tmdbId : String(tmdbId)}` : (imdbId ? `imdb://${imdbId}` : (itemId.startsWith('plex:') ? itemId.replace(/^plex:/, '') : undefined));
    if (plexGuid) {
      promises.push(plexTvAddToWatchlist(plexGuid).catch(console.error));
    }

    // Add to Trakt if authenticated
    const traktTokens = getTraktTokens();
    if (traktTokens && tmdbId) {
      const traktItem = {
        [itemType === 'movie' ? 'movies' : 'shows']: [{
          ids: {
            tmdb: typeof tmdbId === 'string' ? parseInt(tmdbId) : tmdbId,
            ...(imdbId ? { imdb: imdbId } : {})
          },
          ...(title ? { title } : {}),
          ...(year ? { year } : {})
        }]
      };
      promises.push(traktAddToWatchlist(traktTokens.access_token, traktItem).catch(console.error));
    }

    await Promise.all(promises);
  }

  async function removeFromWatchlists() {
    const promises: Promise<any>[] = [];

    // Remove from Plex
    const plexGuid = tmdbId ? `tmdb://${typeof tmdbId === 'string' ? tmdbId : String(tmdbId)}` : (imdbId ? `imdb://${imdbId}` : (itemId.startsWith('plex:') ? itemId.replace(/^plex:/, '') : undefined));
    if (plexGuid) {
      promises.push(plexTvRemoveFromWatchlist(plexGuid).catch(console.error));
    }

    // Remove from Trakt if authenticated
    const traktTokens = getTraktTokens();
    if (traktTokens && tmdbId) {
      const traktItem = {
        [itemType === 'movie' ? 'movies' : 'shows']: [{
          ids: {
            tmdb: typeof tmdbId === 'string' ? parseInt(tmdbId) : tmdbId,
            ...(imdbId ? { imdb: imdbId } : {})
          }
        }]
      };
      promises.push(traktRemoveFromWatchlist(traktTokens.access_token, traktItem).catch(console.error));
    }

    await Promise.all(promises);
  }

  if (checking) {
    return null; // Don't show button while checking status
  }

  if (variant === 'button') {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`inline-flex items-center px-5 py-2.5 text-sm md:text-base font-medium rounded-md transition-all ${
          isInList
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-white/10 text-white hover:bg-white/20'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        {loading ? (
          <div className="w-4 h-4 md:w-5 md:h-5 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : isInList ? (
          <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 md:w-5 md:h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        )}
        {isInList ? 'In My List' : 'Add to My List'}
      </button>
    );
  }

  // Icon variant
  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`w-10 h-10 flex items-center justify-center bg-black/60 rounded-full hover:bg-black/80 transition-all ${
        loading ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      title={isInList ? 'Remove from My List' : 'Add to My List'}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : isInList ? (
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      ) : (
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      )}
    </button>
  );
}
