export type PlexConfig = { baseUrl: string; token: string };
import { cached } from './cache';
import { loadSettings } from '@/state/settings';

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

// Comprehensive search that searches by multiple GUIDs
export async function plexComprehensiveGuidSearch(cfg: PlexConfig, guids: string[], typeNum?: 1|2) {
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:guidsearch:${guids.join(',')}:${typeNum ?? 0}`, 30 * 60 * 1000, async () => {
    const allMatches: any[] = [];
    const seenKeys = new Set<string>();

    // Try each GUID
    for (const guid of guids) {
      try {
        const result = await plexFindByGuid({ baseUrl: cfg.baseUrl, token: cfg.token }, guid, typeNum);
        const items = result?.MediaContainer?.Metadata || [];

        // Add unique items only
        for (const item of items) {
          if (!seenKeys.has(item.ratingKey)) {
            seenKeys.add(item.ratingKey);
            allMatches.push(item);
          }
        }
      } catch {}
    }

    return { MediaContainer: { Metadata: allMatches } };
  });
}

export async function plexFindByGuid(cfg: PlexConfig, guid: string, typeNum?: 1|2) {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:guid:${guid}:${typeNum ?? 0}`, 30 * 60 * 1000, async () => await invoke('plex_find_guid', { baseUrl: cfg.baseUrl, token: cfg.token, guid, type: typeNum ? String(typeNum) : undefined }));
  }

  // Try searching in all library sections if global search fails
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:guid:${guid}:${typeNum ?? 0}`, 30 * 60 * 1000, async () => {
    // First try global search
    try {
      const globalUrl = `${cfg.baseUrl}/library/all?guid=${encodeURIComponent(guid)}${typeNum ? `&type=${typeNum}` : ''}&X-Plex-Token=${cfg.token}`;
      const res = await fetch(globalUrl, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (data?.MediaContainer?.Metadata?.length > 0) {
          return data;
        }
      }
    } catch {}

    // If global search fails, search each library section
    try {
      const libsRes = await fetch(`${cfg.baseUrl}/library/sections?X-Plex-Token=${cfg.token}`, { headers: { Accept: 'application/json' } });
      if (!libsRes.ok) throw new Error(`Failed to get library sections`);
      const libs = await libsRes.json();
      const sections = libs?.MediaContainer?.Directory || [];

      // Filter sections by type if specified
      const targetSections = typeNum
        ? sections.filter((s: any) => (typeNum === 1 && s.type === 'movie') || (typeNum === 2 && s.type === 'show'))
        : sections;

      // Search each section
      for (const section of targetSections) {
        try {
          const sectionUrl = `${cfg.baseUrl}/library/sections/${section.key}/all?guid=${encodeURIComponent(guid)}&X-Plex-Token=${cfg.token}`;
          const sectionRes = await fetch(sectionUrl, { headers: { Accept: 'application/json' } });
          if (sectionRes.ok) {
            const sectionData = await sectionRes.json();
            if (sectionData?.MediaContainer?.Metadata?.length > 0) {
              return sectionData;
            }
          }
        } catch {}
      }
    } catch {}

    // Return empty result if nothing found
    return { MediaContainer: { Metadata: [] } };
  });
}

// Player-specific Plex API methods
export async function plexUniversalDecision(cfg: PlexConfig, itemId: string, options?: {
  maxVideoBitrate?: number;
  autoAdjustQuality?: boolean;
  videoResolution?: string;
  directPlay?: boolean;
  directStream?: boolean;
}) {
  const params = new URLSearchParams({
    hasMDE: '1',
    path: `/library/metadata/${itemId}`,
    mediaIndex: '0',
    partIndex: '0',
    protocol: 'dash',
    fastSeek: '1',
    directPlay: options?.directPlay !== false ? '1' : '0',
    directStream: options?.directStream !== false ? '1' : '0',
    subtitleSize: '100',
    audioBoost: '100',
    session: Math.random().toString(36).substring(2, 15), // Add session ID
    'X-Plex-Client-Identifier': 'plex-mpv-client-web', // Add client identifier
    'X-Plex-Token': cfg.token,
  });

  if (options?.maxVideoBitrate) {
    params.set('maxVideoBitrate', options.maxVideoBitrate.toString());
  }
  if (options?.autoAdjustQuality !== undefined) {
    params.set('autoAdjustQuality', options.autoAdjustQuality ? '1' : '0');
  } else {
    params.set('autoAdjustQuality', '0'); // Default to 0
  }
  if (options?.videoResolution) {
    params.set('videoResolution', options.videoResolution);
  }

  const url = `${cfg.baseUrl}/video/:/transcode/universal/decision?${params}`;
  const res = await fetch(url, { 
    method: 'GET', // Use GET instead of HEAD
    headers: {
      'Accept': 'application/json',
      'X-Plex-Client-Identifier': 'plex-mpv-client-web',
    }
  });
  if (!res.ok) throw new Error(`Plex decision error ${res.status}`);
  return res;
}

export function plexStreamUrl(cfg: PlexConfig, itemId: string, options?: {
  maxVideoBitrate?: number;
  protocol?: 'dash' | 'hls';
  directPlay?: boolean;
  directStream?: boolean;
  session?: string;
}) {
  const sessionId = options?.session || Math.random().toString(36).substring(2, 15);
  const params = new URLSearchParams({
    hasMDE: '1',
    path: `/library/metadata/${itemId}`,
    mediaIndex: '0',
    partIndex: '0',
    protocol: options?.protocol || 'dash',
    fastSeek: '1',
    directPlay: options?.directPlay !== false ? '1' : '0',
    directStream: options?.directStream !== false ? '1' : '0',
    subtitleSize: '100',
    audioBoost: '100',
    location: 'wan',
    addDebugOverlay: '0',
    autoAdjustQuality: '0',
    session: sessionId,
    'X-Plex-Client-Identifier': 'plex-mpv-client-web',
    'X-Plex-Token': cfg.token,
  });

  if (options?.maxVideoBitrate) {
    params.set('maxVideoBitrate', options.maxVideoBitrate.toString());
  }

  const ext = options?.protocol === 'hls' ? 'm3u8' : 'mpd';
  return `${cfg.baseUrl}/video/:/transcode/universal/start.${ext}?${params}`;
}

export async function plexTimelineUpdate(cfg: PlexConfig, itemId: string, time: number, duration: number, state: 'playing' | 'paused' | 'stopped' | 'buffering') {
  const params = new URLSearchParams({
    ratingKey: itemId,
    key: `/library/metadata/${itemId}`,
    playbackTime: Math.floor(time).toString(),
    duration: Math.floor(duration).toString(),
    state,
    'X-Plex-Token': cfg.token,
  });

  const url = `${cfg.baseUrl}/:/timeline?${params}`;
  const res = await fetch(url);
  if (!res.ok) console.warn('Timeline update failed:', res.status);
  return res;
}

export async function plexPing(cfg: PlexConfig) {
  const url = `${cfg.baseUrl}/:/ping?X-Plex-Token=${cfg.token}`;
  const res = await fetch(url);
  return res.ok;
}

export async function plexUpdateAudioStream(cfg: PlexConfig, partId: string, streamId: string) {
  const params = new URLSearchParams({
    audioStreamID: streamId,
    allParts: '1',
    'X-Plex-Token': cfg.token,
  });

  const url = `${cfg.baseUrl}/library/parts/${partId}?${params}`;
  const res = await fetch(url, { method: 'PUT' });
  if (!res.ok) throw new Error(`Failed to update audio stream: ${res.status}`);
  return res;
}

export async function plexUpdateSubtitleStream(cfg: PlexConfig, partId: string, streamId: string) {
  const params = new URLSearchParams({
    subtitleStreamID: streamId,
    allParts: '1',
    'X-Plex-Token': cfg.token,
  });

  const url = `${cfg.baseUrl}/library/parts/${partId}?${params}`;
  const res = await fetch(url, { method: 'PUT' });
  if (!res.ok) throw new Error(`Failed to update subtitle stream: ${res.status}`);
  return res;
}

export async function plexPlayQueue(cfg: PlexConfig, itemId: string) {
  const params = new URLSearchParams({
    type: 'video',
    uri: `server://*/com.plexapp.plugins.library/library/metadata/${itemId}`,
    includeChapters: '1',
    includeMarkers: '1',
    includeRelated: '1',
    'X-Plex-Token': cfg.token,
  });

  const url = `${cfg.baseUrl}/playQueues?${params}`;
  const res = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to create play queue: ${res.status}`);
  return res.json();
}

// Recently added across libraries (web convenience)
export async function plexRecentlyAdded(days: number = 7, limitPerLib: number = 50): Promise<any[]> {
  try {
    const s = loadSettings();
    if (!s.plexBaseUrl || !s.plexToken) return [];
    const cfg = { baseUrl: s.plexBaseUrl!, token: s.plexToken! };
    const libs: any = await plexLibs(cfg);
    const dirs = libs?.MediaContainer?.Directory || [];
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const all: any[] = [];
    for (const d of dirs) {
      if (d.type !== 'movie' && d.type !== 'show') continue;
      try {
        const qs = `?type=${d.type === 'movie' ? 1 : 2}&sort=addedAt:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${limitPerLib}`;
        const res: any = await plexSectionAll(cfg, String(d.key), qs);
        const meta: any[] = res?.MediaContainer?.Metadata || [];
        for (const m of meta) {
          const added = (m.addedAt ? (Number(m.addedAt) * 1000) : 0);
          if (!added || added >= since) all.push(m);
        }
      } catch {}
    }
    // Sort globally by addedAt desc and cap
    all.sort((a:any,b:any)=> (b.addedAt||0) - (a.addedAt||0));
    return all.slice(0, 100);
  } catch {
    return [];
  }
}

// Popular on Plex across libraries
export async function plexPopular(limitPerLib: number = 50): Promise<any[]> {
  try {
    const s = loadSettings();
    if (!s.plexBaseUrl || !s.plexToken) return [];
    const cfg = { baseUrl: s.plexBaseUrl!, token: s.plexToken! };
    const libs: any = await plexLibs(cfg);
    const dirs = libs?.MediaContainer?.Directory || [];
    const all: any[] = [];
    for (const d of dirs) {
      if (d.type !== 'movie' && d.type !== 'show') continue;
      let res: any = null;
      // Try lastViewedAt first, then viewCount
      try {
        const qs = `?type=${d.type === 'movie' ? 1 : 2}&sort=lastViewedAt:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${limitPerLib}`;
        res = await plexSectionAll(cfg, String(d.key), qs);
      } catch {}
      if (!res) {
        try {
          const qs2 = `?type=${d.type === 'movie' ? 1 : 2}&sort=viewCount:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${limitPerLib}`;
          res = await plexSectionAll(cfg, String(d.key), qs2);
        } catch {}
      }
      const meta: any[] = res?.MediaContainer?.Metadata || [];
      all.push(...meta);
    }
    // Prefer items with lastViewedAt/viewCount and recent activity
    const score = (m:any) => {
      const lv = (m.lastViewedAt||0);
      const vc = (m.viewCount||0);
      return (lv * 10) + vc;
    };
    all.sort((a:any,b:any)=> score(b) - score(a));
    return all.slice(0, 100);
  } catch {
    return [];
  }
}
