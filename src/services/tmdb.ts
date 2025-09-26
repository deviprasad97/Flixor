const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
import { cached } from './cache';

function normalizeBearer(input: string): string {
  if (!input) return '';
  // Remove leading "Bearer ", trim, and drop any non JWT-safe ASCII (JWT uses base64url + dots)
  const token = input.replace(/^\s*Bearer\s+/i, '').trim();
  return token.replace(/[^A-Za-z0-9\-_.]/g, '');
}

export type TmdbTrendingItem = { id: number; title?: string; name?: string; poster_path?: string; backdrop_path?: string };

export async function tmdbTrending(key: string, media: 'movie'|'tv' = 'movie', window: 'day'|'week' = 'week') {
  const token = normalizeBearer(key);
  // Tauri backend path preferred to avoid CORS and keep secrets local
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    // 30m TTL for feeds
    return cached(`tmdb:trending:${media}:${window}`, 30 * 60 * 1000, async () =>
      await (invoke('tmdb_trending', { media, window, bearer: token }) as Promise<{ results: TmdbTrendingItem[] }>));
  }
  return cached(`tmdb:trending:${media}:${window}`, 30 * 60 * 1000, async () => {
    const res = await fetch(`${TMDB}/trending/${media}/${window}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export function tmdbImage(path?: string, size: 'w500'|'w780'|'w1280'|'original' = 'w780') {
  return path ? `${IMG}/${size}${path}` : undefined;
}

export async function tmdbDetails(key: string, media: 'movie'|'tv', id: string | number) {
  const token = normalizeBearer(key);
  // Prefer Tauri backend fetch where possible; fallback to web
  return cached(`tmdb:details:${media}:${id}`, 24 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${media}/${id}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbCredits(key: string, media: 'movie'|'tv', id: string | number) {
  const token = normalizeBearer(key);
  return cached(`tmdb:credits:${media}:${id}`, 24 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${media}/${id}/credits`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbExternalIds(key: string, media: 'movie'|'tv', id: string | number) {
  const token = normalizeBearer(key);
  return cached(`tmdb:external:${media}:${id}`, 24 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${media}/${id}/external_ids`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbRecommendations(key: string, media: 'movie'|'tv', id: string | number, page?: number) {
  const token = normalizeBearer(key);
  return cached(`tmdb:recs:${media}:${id}:${page||1}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${media}/${id}/recommendations${page?`?page=${page}`:''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbSimilar(key: string, media: 'movie'|'tv', id: string | number, page?: number) {
  const token = normalizeBearer(key);
  return cached(`tmdb:similar:${media}:${id}:${page||1}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${media}/${id}/similar${page?`?page=${page}`:''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbSearchTitle(key: string, media: 'movie'|'tv', query: string, year?: string | number) {
  const token = normalizeBearer(key);
  const endpoint = media === 'movie' ? 'search/movie' : 'search/tv';
  const q = new URLSearchParams({ query, include_adult: 'false', ...(year ? (media==='movie'? { year: String(year) } : { first_air_date_year: String(year) }) : {}) });
  return cached(`tmdb:search:${media}:${query}:${year||''}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${endpoint}?${q.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbTvSeasons(key: string, tvId: string | number) {
  const token = normalizeBearer(key);
  return cached(`tmdb:tv:seasons:${tvId}`, 24 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/tv/${tvId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbTvSeasonEpisodes(key: string, tvId: string | number, seasonNumber: number) {
  const token = normalizeBearer(key);
  return cached(`tmdb:tv:season:${tvId}:${seasonNumber}`, 24 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/tv/${tvId}/season/${seasonNumber}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbSearchPerson(key: string, name: string) {
  const token = normalizeBearer(key);
  return cached(`tmdb:searchPerson:${name}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/search/person?query=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbPersonCombined(key: string, personId: string | number) {
  const token = normalizeBearer(key);
  return cached(`tmdb:personCombined:${personId}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/person/${personId}/combined_credits`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbVideos(key: string, media: 'movie'|'tv', id: string | number) {
  const token = normalizeBearer(key);
  return cached(`tmdb:videos:${media}:${id}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${media}/${id}/videos`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbSearchMulti(key: string, query: string) {
  const token = normalizeBearer(key);
  return cached(`tmdb:searchMulti:${query}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/search/multi?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbPopular(key: string, media: 'movie'|'tv' = 'movie') {
  const token = normalizeBearer(key);
  return cached(`tmdb:popular:${media}`, 6 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${media}/popular`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbImages(key: string, media: 'movie'|'tv', id: string | number, includeImageLanguage = 'en,null') {
  const token = normalizeBearer(key);
  return cached(`tmdb:images:${media}:${id}:${includeImageLanguage}`, 24 * 60 * 60 * 1000, async () => {
    const url = `${TMDB}/${media}/${id}/images?include_image_language=${encodeURIComponent(includeImageLanguage)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}

export async function tmdbBestBackdropUrl(key: string, media: 'movie'|'tv', id: string | number, lang: string = 'en'): Promise<string | undefined> {
  // Prefer language-specific backdrops (e.g., with title text), else fall back to any
  try {
    const imgs: any = await tmdbImages(key, media, id, `${lang},null`);
    const list: any[] = imgs?.backdrops || [];
    if (!list.length) return undefined;
    const pick = (arr: any[]) => arr.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0];
    const en = pick(list.filter((b: any) => b.iso_639_1 === lang));
    const nul = pick(list.filter((b: any) => !b.iso_639_1));
    const any = pick(list);
    const sel = en || nul || any;
    return sel?.file_path ? tmdbImage(sel.file_path, 'original') : undefined;
  } catch { return undefined; }
}

// Upcoming movies (regionalized)
export async function tmdbUpcoming(key: string, region?: string) {
  const token = normalizeBearer(key);
  const r = region ? `&region=${encodeURIComponent(region)}` : '';
  // 30m TTL
  return cached(`tmdb:upcoming:${region || 'any'}`, 30 * 60 * 1000, async () => {
    const url = `${TMDB}/movie/upcoming?language=en-US${r}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  });
}
