const TRAKT = 'https://api.trakt.tv';
export async function traktTrending(clientId: string, type: 'movies'|'shows' = 'movies') {
  // Prefer backend invoke (avoids CORS surprises)
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_trending', { kind: type, clientId }) as Promise<any>;
  }
  const res = await fetch(`${TRAKT}/${type}/trending`, { headers: { 'trakt-api-version': '2', 'trakt-api-key': clientId } });
  if (!res.ok) throw new Error(`Trakt error ${res.status}`);
  return res.json();
}
