import { loadSettings } from '@/state/settings';

// Minimal Plex.tv watchlist fetch using account token (optional: defaults from settings)
export async function plexTvWatchlist(accToken?: string) {
  const token = accToken || loadSettings().plexTvToken || loadSettings().plexAccountToken;
  if (!token) throw new Error('Missing Plex.tv account token');
  const qs = new URLSearchParams({
    'X-Plex-Token': token,
    includeAdvanced: '1',
    includeMeta: '1',
    'X-Plex-Container-Start': '0',
    'X-Plex-Container-Size': '200',
  });
  const url = `https://discover.provider.plex.tv/library/sections/watchlist/all?${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Plex.tv error ${res.status}`);
  return res.json();
}

// Add an item to Plex.tv Watchlist. Accepts a Plex ratingKey or a guid (tmdb://, imdb://, etc.)
export async function plexTvAddToWatchlist(idOrGuid: string, accToken?: string) {
  const token = accToken || loadSettings().plexTvToken || loadSettings().plexAccountToken;
  if (!token) throw new Error('Missing Plex.tv account token');
  const id = encodeURIComponent(idOrGuid);
  const url = `https://discover.provider.plex.tv/library/metadata/${id}/watchlist?X-Plex-Token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: 'PUT' });
  if (!res.ok) throw new Error(`Failed to add to Plex.tv Watchlist: ${res.status}`);
  return true;
}

// Remove an item from Plex.tv Watchlist
export async function plexTvRemoveFromWatchlist(idOrGuid: string, accToken?: string) {
  const token = accToken || loadSettings().plexTvToken || loadSettings().plexAccountToken;
  if (!token) throw new Error('Missing Plex.tv account token');
  const id = encodeURIComponent(idOrGuid);
  const url = `https://discover.provider.plex.tv/library/metadata/${id}/watchlist?X-Plex-Token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to remove from Plex.tv Watchlist: ${res.status}`);
  return true;
}
