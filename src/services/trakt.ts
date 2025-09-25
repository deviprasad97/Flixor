import { invoke } from '@tauri-apps/api/core';
import { loadSettings, saveSettings } from '@/state/settings';

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
  return invoke('trakt_device_code', { clientId: CLIENT_ID });
}

export async function traktPollForToken(deviceCode: string): Promise<TraktTokens | null> {
  return invoke('trakt_poll_token', {
    deviceCode,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET
  });
}

export async function traktRefreshToken(refreshToken: string): Promise<TraktTokens> {
  return invoke('trakt_refresh_token', {
    refreshToken,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET
  });
}

export async function traktRevokeToken(accessToken: string): Promise<void> {
  return invoke('trakt_revoke_token', {
    accessToken,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET
  });
}

// User
export async function traktGetUserProfile(accessToken: string): Promise<TraktUser> {
  return invoke('trakt_user_profile', { accessToken });
}

export async function traktGetUserSettings(accessToken: string): Promise<any> {
  return invoke('trakt_user_settings', { accessToken });
}

// Scrobbling
export async function traktScrobbleStart(accessToken: string, item: TraktScrobble): Promise<any> {
  return invoke('trakt_scrobble_start', { accessToken, item });
}

export async function traktScrobblePause(accessToken: string, item: TraktScrobble): Promise<any> {
  return invoke('trakt_scrobble_pause', { accessToken, item });
}

export async function traktScrobbleStop(accessToken: string, item: TraktScrobble): Promise<any> {
  return invoke('trakt_scrobble_stop', { accessToken, item });
}

// History
export async function traktGetHistory(accessToken: string, type?: 'movies' | 'shows', limit?: number): Promise<any[]> {
  return invoke('trakt_history', { accessToken, type, limit });
}

export async function traktAddToHistory(accessToken: string, items: any[]): Promise<any> {
  return invoke('trakt_history_add', { accessToken, items });
}

export async function traktRemoveFromHistory(accessToken: string, items: any[]): Promise<any> {
  return invoke('trakt_history_remove', { accessToken, items });
}

// Watchlist
export async function traktGetWatchlist(accessToken: string, type?: 'movies' | 'shows'): Promise<any[]> {
  return invoke('trakt_watchlist', { accessToken, type });
}

export async function traktAddToWatchlist(accessToken: string, items: any[]): Promise<any> {
  return invoke('trakt_watchlist_add', { accessToken, items });
}

export async function traktRemoveFromWatchlist(accessToken: string, items: any[]): Promise<any> {
  return invoke('trakt_watchlist_remove', { accessToken, items });
}

// Progress
export async function traktGetProgress(accessToken: string, type: 'shows', sort?: string): Promise<any[]> {
  return invoke('trakt_progress', { accessToken, type, sort });
}

// Recommendations
export async function traktGetRecommendations(accessToken: string, type: 'movies' | 'shows', limit?: number): Promise<any[]> {
  return invoke('trakt_recommendations', { accessToken, type, limit });
}

// Search
export async function traktSearch(query: string, type?: 'movie' | 'show' | 'episode', limit?: number): Promise<any[]> {
  return invoke('trakt_search', { query, type, limit, clientId: CLIENT_ID });
}

// Trending (existing, updated)
export async function traktTrending(type: 'movies'|'shows' = 'movies', limit?: number): Promise<any[]> {
  return invoke('trakt_trending', { kind: type, clientId: CLIENT_ID, limit });
}

// Popular
export async function traktPopular(type: 'movies' | 'shows', limit?: number): Promise<any[]> {
  return invoke('trakt_popular', { type, clientId: CLIENT_ID, limit });
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
