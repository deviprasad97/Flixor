export type PlexConfig = { baseUrl: string; token: string };
import { cached } from './cache';

export async function plexLibs(cfg: PlexConfig) {
  // Prefer backend invoke for Plex due to CORS restrictions on many servers
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:libs`, 15 * 60 * 1000, async () => {
      const res: any = await invoke('plex_sections', { baseUrl: cfg.baseUrl, token: cfg.token });
      // Filter libraries to Movies and TV Shows only
      try {
        if (res && res.MediaContainer && Array.isArray(res.MediaContainer.Directory)) {
          res.MediaContainer.Directory = res.MediaContainer.Directory.filter((d: any) => d.type === 'movie' || d.type === 'show');
        }
      } catch {}
      return res;
    });
  }
  const url = `${cfg.baseUrl}/library/sections?X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:libs`, 15 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    const json = await res.json();
    try {
      if (json && json.MediaContainer && Array.isArray(json.MediaContainer.Directory)) {
        json.MediaContainer.Directory = json.MediaContainer.Directory.filter((d: any) => d.type === 'movie' || d.type === 'show');
      }
    } catch {}
    return json;
  });
}

export async function plexOnDeck(cfg: PlexConfig, libKey: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:onDeck:${libKey}`, 5 * 60 * 1000, async () => await invoke('plex_on_deck', { baseUrl: cfg.baseUrl, token: cfg.token, libraryKey: libKey }));
  }
  const url = `${cfg.baseUrl}/library/sections/${libKey}/onDeck?X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:onDeck:${libKey}`, 5 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

export async function plexOnDeckGlobal(cfg: PlexConfig) {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:onDeckGlobal`, 2 * 60 * 1000, async () => await invoke('plex_on_deck_global', { baseUrl: cfg.baseUrl, token: cfg.token }));
  }
  const url = `${cfg.baseUrl}/library/onDeck?X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:onDeckGlobal`, 2 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

export function plexImage(baseUrl: string, token: string, path?: string) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${baseUrl.replace(/\/$/, '')}${path}${sep}X-Plex-Token=${token}`;
}

export async function plexSectionAll(cfg: PlexConfig, sectionKey: string, params?: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    if (!sectionKey) throw new Error('Missing section key');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:all:${sectionKey}:${params ?? ''}`, 10 * 60 * 1000, async () => await invoke('plex_sections_all', { baseUrl: cfg.baseUrl, token: cfg.token, sectionKey, params }));
  }
  const qs = params?.startsWith('?') ? params : `?${params ?? 'type=1&sort=addedAt:desc'}`;
  if (!sectionKey) throw new Error('Missing section key');
  const url = `${cfg.baseUrl}/library/sections/${sectionKey}/all${qs}${qs.includes('X-Plex-Token') ? '' : (qs.includes('?') ? '&' : '?') + 'X-Plex-Token=' + cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:all:${sectionKey}:${qs}`, 10 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

export function withContainer(qs: string, start: number, size: number) {
  const sep = qs.includes('?') ? '&' : '?';
  return `${qs}${sep}X-Plex-Container-Start=${start}&X-Plex-Container-Size=${size}`;
}

// Fetch secondary directories for a library section, e.g., genre, year, etc.
export async function plexLibrarySecondary(cfg: PlexConfig, sectionKey: string, directory: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    // Fallback to web fetch when tauri cmd not available for this route
  }
  const url = `${cfg.baseUrl}/library/sections/${sectionKey}/${directory}?X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:secondary:${sectionKey}:${directory}`, 60 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

// Generic directory fetch: GET a Plex path under /library (or /library/metadata/.../similar etc.)
export async function plexDir(cfg: PlexConfig, path: string, qs?: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${cfg.baseUrl}${p}${p.includes('?') ? '&' : (qs ? (qs.startsWith('?') ? '' : '?') : '?')}X-Plex-Token=${cfg.token}${qs ? `${p.includes('?')?'&':''}${qs.replace(/^\?/, '')}` : ''}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:dir:${p}:${qs || ''}`, 10 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

export async function plexMetadata(cfg: PlexConfig, ratingKey: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:meta:${ratingKey}`, 24 * 60 * 60 * 1000, async () => await invoke('plex_metadata', { baseUrl: cfg.baseUrl, token: cfg.token, ratingKey }));
  }
  const url = `${cfg.baseUrl}/library/metadata/${ratingKey}?X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:meta:${ratingKey}`, 24 * 60 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

// Fetch metadata with extras/external media included to access trailers
export async function plexMetadataWithExtras(cfg: PlexConfig, ratingKey: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    // Fall back to direct fetch via frontend for now, since tauri cmd lacks include params
  }
  const url = `${cfg.baseUrl}/library/metadata/${ratingKey}?includeExtras=1&includeExternalMedia=1&includeChildren=1&X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:meta_extras:${ratingKey}`, 6 * 60 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

// Build a full URL to a Plex part key (e.g., Extras Media Part key)
export function plexPartUrl(baseUrl: string, token: string, partKey: string) {
  // partKey may already have query params; append token accordingly
  const sep = partKey.includes('?') ? '&' : '?';
  const base = baseUrl.replace(/\/$/, '');
  // Ensure partKey begins with '/'
  const key = partKey.startsWith('/') ? partKey : `/${partKey}`;
  return `${base}${key}${sep}X-Plex-Token=${token}`;
}

export async function plexSearch(cfg: PlexConfig, query: string, typeNum: 1|2 = 1) {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:search:${typeNum}:${query}`, 10 * 60 * 1000, async () => await invoke('plex_search', { baseUrl: cfg.baseUrl, token: cfg.token, query, type: String(typeNum) }));
  }
  const url = `${cfg.baseUrl}/search?type=${typeNum}&query=${encodeURIComponent(query)}&X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:search:${typeNum}:${query}`, 10 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

export async function plexChildren(cfg: PlexConfig, ratingKey: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:children:${ratingKey}`, 10 * 60 * 1000, async () => await invoke('plex_children', { baseUrl: cfg.baseUrl, token: cfg.token, ratingKey }));
  }
  const url = `${cfg.baseUrl}/library/metadata/${ratingKey}/children?X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:children:${ratingKey}`, 10 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}

export async function plexFindByGuid(cfg: PlexConfig, guid: string, typeNum?: 1|2) {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:guid:${guid}:${typeNum ?? 0}`, 30 * 60 * 1000, async () => await invoke('plex_find_guid', { baseUrl: cfg.baseUrl, token: cfg.token, guid, type: typeNum ? String(typeNum) : undefined }));
  }
  const url = `${cfg.baseUrl}/library/all?guid=${encodeURIComponent(guid)}${typeNum ? `&type=${typeNum}` : ''}&X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:guid:${guid}:${typeNum ?? 0}`, 30 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Plex error ${res.status}`);
    return res.json();
  });
}
