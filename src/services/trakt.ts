import { loadSettings, saveSettings } from '@/state/settings';

// Check if running in Tauri context
function isTauri() {
  // @ts-ignore
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
}

const TRAKT = 'https://api.trakt.tv';
const CLIENT_ID = '4ab0ead6d5510bf39180a5e1dd7b452f5ad700b7794564befdd6bca56e0f7ce4';
const CLIENT_SECRET = '64d24f12e4628dcf0dda74a61f2235c086daaf8146384016b6a86c196e419c26';

export interface TraktDeviceCode {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

export interface TraktTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: number;
}

export interface TraktUser {
  username: string;
  private: boolean;
  name: string;
  vip: boolean;
  vip_ep: boolean;
  ids: {
    slug: string;
  };
  joined_at: string;
  location: string;
  about: string;
  gender: string;
  age: number;
  images: {
    avatar: {
      full: string;
    };
  };
}

export interface TraktScrobble {
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
  progress: number;
  app_version: string;
  app_date: string;
}

export interface TraktMovie {
  title: string;
  year: number;
  ids: {
    trakt: number;
    slug: string;
    imdb?: string;
    tmdb?: number;
  };
}

export interface TraktShow {
  title: string;
  year: number;
  ids: {
    trakt: number;
    slug: string;
    imdb?: string;
    tmdb?: number;
    tvdb?: number;
  };
}

export interface TraktEpisode {
  season: number;
  number: number;
  title?: string;
  ids: {
    trakt: number;
    tvdb?: number;
    imdb?: string;
    tmdb?: number;
  };
}

// Authentication
export async function traktRequestDeviceCode(): Promise<TraktDeviceCode> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_device_code', { clientId: CLIENT_ID });
  }

  // Web fallback - direct API call
  const response = await fetch('https://api.trakt.tv/oauth/device/code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: CLIENT_ID
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to get device code: ${response.status}`);
  }

  return response.json();
}

export async function traktPollForToken(deviceCode: string): Promise<TraktTokens | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_poll_token', {
      deviceCode,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET
    });
  }

  // Web fallback
  const response = await fetch('https://api.trakt.tv/oauth/device/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: deviceCode,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })
  });

  if (response.status === 400) {
    // Still pending authorization
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to poll token: ${response.status}`);
  }

  return response.json();
}

export async function traktRefreshToken(refreshToken: string): Promise<TraktTokens> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_refresh_token', {
      refreshToken,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET
    });
  }

  // Web fallback
  const response = await fetch('https://api.trakt.tv/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  return response.json();
}

export async function traktRevokeToken(accessToken: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_revoke_token', {
      accessToken,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET
    });
  }

  // Web fallback
  const response = await fetch('https://api.trakt.tv/oauth/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: accessToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to revoke token: ${response.status}`);
  }
}

// User
export async function traktGetUserProfile(accessToken: string): Promise<TraktUser> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_user_profile', { accessToken });
  }

  // Web fallback
  const response = await fetch('https://api.trakt.tv/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get user profile: ${response.status}`);
  }

  return response.json();
}

export async function traktGetUserSettings(accessToken: string): Promise<any> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_user_settings', { accessToken });
  }

  // Web fallback
  const response = await fetch('https://api.trakt.tv/users/settings', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get user settings: ${response.status}`);
  }

  return response.json();
}

// Scrobbling
export async function traktScrobbleStart(accessToken: string, item: TraktScrobble): Promise<any> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_scrobble_start', { accessToken, item });
  }

  const response = await fetch('https://api.trakt.tv/scrobble/start', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    },
    body: JSON.stringify(item)
  });

  if (!response.ok) throw new Error(`Failed to start scrobble: ${response.status}`);
  return response.json();
}

export async function traktScrobblePause(accessToken: string, item: TraktScrobble): Promise<any> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_scrobble_pause', { accessToken, item });
  }

  const response = await fetch('https://api.trakt.tv/scrobble/pause', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    },
    body: JSON.stringify(item)
  });

  if (!response.ok) throw new Error(`Failed to pause scrobble: ${response.status}`);
  return response.json();
}

export async function traktScrobbleStop(accessToken: string, item: TraktScrobble): Promise<any> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_scrobble_stop', { accessToken, item });
  }

  const response = await fetch('https://api.trakt.tv/scrobble/stop', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    },
    body: JSON.stringify(item)
  });

  if (!response.ok) throw new Error(`Failed to stop scrobble: ${response.status}`);
  return response.json();
}

// History
export async function traktGetHistory(accessToken: string, type?: 'movies' | 'shows', limit?: number): Promise<any[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_history', { accessToken, type, limit });
  }

  let url = 'https://api.trakt.tv/users/me/history';
  if (type) url += `/${type}`;
  if (limit) url += `?limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) throw new Error(`Failed to get history: ${response.status}`);
  return response.json();
}

export async function traktAddToHistory(accessToken: string, items: any[]): Promise<any> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_history_add', { accessToken, items });
  }

  const response = await fetch('https://api.trakt.tv/sync/history', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    },
    body: JSON.stringify(items)
  });

  if (!response.ok) throw new Error(`Failed to add to history: ${response.status}`);
  return response.json();
}

export async function traktRemoveFromHistory(accessToken: string, items: any[]): Promise<any> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_history_remove', { accessToken, items });
  }

  const response = await fetch('https://api.trakt.tv/sync/history/remove', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    },
    body: JSON.stringify(items)
  });

  if (!response.ok) throw new Error(`Failed to remove from history: ${response.status}`);
  return response.json();
}

// Watchlist
export async function traktGetWatchlist(accessToken: string, type?: 'movies' | 'shows'): Promise<any[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_watchlist', { accessToken, type });
  }

  let url = 'https://api.trakt.tv/users/me/watchlist';
  if (type) url += `/${type}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) throw new Error(`Failed to get watchlist: ${response.status}`);
  return response.json();
}

export async function traktAddToWatchlist(accessToken: string, items: any[]): Promise<any> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_watchlist_add', { accessToken, items });
  }

  const response = await fetch('https://api.trakt.tv/sync/watchlist', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    },
    body: JSON.stringify(items)
  });

  if (!response.ok) throw new Error(`Failed to add to watchlist: ${response.status}`);
  return response.json();
}

export async function traktRemoveFromWatchlist(accessToken: string, items: any[]): Promise<any> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_watchlist_remove', { accessToken, items });
  }

  const response = await fetch('https://api.trakt.tv/sync/watchlist/remove', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    },
    body: JSON.stringify(items)
  });

  if (!response.ok) throw new Error(`Failed to remove from watchlist: ${response.status}`);
  return response.json();
}

// Progress
export async function traktGetProgress(accessToken: string, type: 'shows', sort?: string): Promise<any[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_progress', { accessToken, type, sort });
  }

  let url = `https://api.trakt.tv/users/me/watched/${type}/progress`;
  if (sort) url += `?sort=${sort}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) throw new Error(`Failed to get progress: ${response.status}`);
  return response.json();
}

// Recommendations
export async function traktGetRecommendations(accessToken: string, type: 'movies' | 'shows', limit?: number): Promise<any[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_recommendations', { accessToken, type, limit });
  }

  let url = `https://api.trakt.tv/recommendations/${type}`;
  if (limit) url += `?limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) throw new Error(`Failed to get recommendations: ${response.status}`);
  return response.json();
}

// Search
export async function traktSearch(query: string, type?: 'movie' | 'show' | 'episode', limit?: number): Promise<any[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_search', { query, type, limit, clientId: CLIENT_ID });
  }

  const searchType = type || 'movie,show';
  let url = `https://api.trakt.tv/search/${searchType}?query=${encodeURIComponent(query)}`;
  if (limit) url += `&limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) throw new Error(`Failed to search: ${response.status}`);
  return response.json();
}

// Trending (existing, updated)
export async function traktTrending(type: 'movies'|'shows' = 'movies', limit?: number): Promise<any[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_trending', { kind: type, clientId: CLIENT_ID, limit });
  }

  let url = `https://api.trakt.tv/${type}/trending`;
  if (limit) url += `?limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) throw new Error(`Failed to get trending: ${response.status}`);
  return response.json();
}

// Popular
export async function traktPopular(type: 'movies' | 'shows', limit?: number): Promise<any[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('trakt_popular', { type, clientId: CLIENT_ID, limit });
  }

  let url = `https://api.trakt.tv/${type}/popular`;
  if (limit) url += `?limit=${limit}`;

  const response = await fetch(url, {
    headers: {
      'trakt-api-version': '2',
      'trakt-api-key': CLIENT_ID
    }
  });

  if (!response.ok) throw new Error(`Failed to get popular: ${response.status}`);
  return response.json();
}

// Token Management Helpers
export function getTraktTokens(): TraktTokens | null {
  const settings = loadSettings();
  if (settings.traktTokens) {
    try {
      return JSON.parse(settings.traktTokens);
    } catch {
      return null;
    }
  }
  return null;
}

export function saveTraktTokens(tokens: TraktTokens | null): void {
  saveSettings({
    traktTokens: tokens ? JSON.stringify(tokens) : undefined
  });
}

export function isTraktAuthenticated(): boolean {
  const tokens = getTraktTokens();
  if (!tokens) return false;

  // Check if token is expired
  const expiresAt = (tokens.created_at + tokens.expires_in) * 1000;
  return Date.now() < expiresAt;
}

export async function ensureValidToken(): Promise<string | null> {
  const tokens = getTraktTokens();
  if (!tokens) return null;

  const expiresAt = (tokens.created_at + tokens.expires_in) * 1000;
  const isExpired = Date.now() >= expiresAt;

  if (isExpired && tokens.refresh_token) {
    try {
      const newTokens = await traktRefreshToken(tokens.refresh_token);
      saveTraktTokens(newTokens);
      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh Trakt token:', error);
      saveTraktTokens(null);
      return null;
    }
  }

  return tokens.access_token;
}
