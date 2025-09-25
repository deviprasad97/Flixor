import { loadSettings } from '@/state/settings';

// Simple in-memory cache + rate-limit handling for Plex.tv watchlist
let watchlistCache: { data: any; expiresAt: number } | null = null;
let watchlistInFlight: Promise<any> | null = null;
let rateLimitedUntil: number | null = null; // epoch ms when we can retry

export function clearPlexTvWatchlistCache() {
  watchlistCache = null;
}

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
  // Obey temporary rate limit if set. If no cache, consolidate callers behind a single delayed fetch.
  if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
    if (watchlistCache) return watchlistCache.data; // serve stale cache rather than error
    if (watchlistInFlight) return watchlistInFlight;
    watchlistInFlight = (async () => {
      const waitMs = Math.max(0, (rateLimitedUntil ?? Date.now()) - Date.now());
      if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
      // Try once after wait
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Plex.tv error ${res.status}`);
      const data = await res.json();
      watchlistCache = { data, expiresAt: Date.now() + 60_000 };
      rateLimitedUntil = null;
      return data;
    })();
    try { return await watchlistInFlight; } finally { watchlistInFlight = null; }
  }
  // Return cached if still fresh (60s TTL)
  if (watchlistCache && Date.now() < watchlistCache.expiresAt) return watchlistCache.data;
  // De-duplicate concurrent requests
  if (watchlistInFlight) return watchlistInFlight;
  watchlistInFlight = (async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    // Handle 429 with Retry-After if provided
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60_000;
      rateLimitedUntil = Date.now() + (isNaN(retryMs) ? 60_000 : retryMs);
      if (watchlistCache) return watchlistCache.data; // serve stale cache if available
      // Wait once, then retry to avoid spamming errors
      const wait = Math.max(0, (rateLimitedUntil ?? Date.now()) - Date.now());
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      const res2 = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res2.ok) throw new Error(`Plex.tv error ${res2.status}`);
      const data2 = await res2.json();
      watchlistCache = { data: data2, expiresAt: Date.now() + 60_000 };
      rateLimitedUntil = null;
      return data2;
    }
    if (!res.ok) throw new Error(`Plex.tv error ${res.status}`);
    const data = await res.json();
    // Cache for 60s
    watchlistCache = { data, expiresAt: Date.now() + 60_000 };
    rateLimitedUntil = null;
    return data;
  })();
  try {
    return await watchlistInFlight;
  } finally {
    watchlistInFlight = null;
  }
}

// Add an item to Plex.tv Watchlist. Accepts a Plex ratingKey or a guid (tmdb://, imdb://, etc.)
export async function plexTvAddToWatchlist(idOrGuid: string, accToken?: string) {
  const token = accToken || loadSettings().plexTvToken || loadSettings().plexAccountToken;
  if (!token) throw new Error('Missing Plex.tv account token');
  const id = encodeURIComponent(idOrGuid);
  const url = `https://discover.provider.plex.tv/library/metadata/${id}/watchlist?X-Plex-Token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: 'PUT' });
  if (!res.ok) throw new Error(`Failed to add to Plex.tv Watchlist: ${res.status}`);
  clearPlexTvWatchlistCache();
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
  clearPlexTvWatchlistCache();
  return true;
}
