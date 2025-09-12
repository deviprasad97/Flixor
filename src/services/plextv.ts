// Minimal Plex.tv watchlist fetch using account token
export async function plexTvWatchlist(accToken: string) {
  const qs = new URLSearchParams({
    'X-Plex-Token': accToken,
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

