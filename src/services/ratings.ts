// Plex-backed ratings helpers

// Plex-backed ratings by ratingKey (server metadata)
export async function fetchPlexRatingsByRatingKey(ratingKey: string): Promise<{ imdb?: { rating?: number; votes?: number } | null; rt?: { critic?: number; audience?: number } | null } | null> {
  if (!ratingKey) return null;
  const base = (() => {
    try { const loc = window.location; if (loc && loc.port === '5173') return 'http://localhost:3001/api/plex/ratings'; } catch {}
    return '/api/plex/ratings';
  })();
  const res = await fetch(`${base}/${encodeURIComponent(ratingKey)}`, { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  return { imdb: data.imdb || null, rt: data.rottenTomatoes || null };
}

export async function fetchPlexVodRatingsById(vodId: string): Promise<{ imdb?: { rating?: number; votes?: number } | null; rt?: { critic?: number; audience?: number } | null } | null> {
  if (!vodId) return null;
  const base = (() => {
    try { const loc = window.location; if (loc && loc.port === '5173') return 'http://localhost:3001/api/plex/vod/ratings'; } catch {}
    return '/api/plex/vod/ratings';
  })();
  const res = await fetch(`${base}/${encodeURIComponent(vodId)}`, { credentials: 'include' });
  if (!res.ok) return null;
  const data = await res.json();
  return { imdb: data.imdb || null, rt: data.rottenTomatoes || null };
}
