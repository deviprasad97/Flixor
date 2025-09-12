import { loadSettings } from '@/state/settings';
import { cached } from './cache';

type PlexCfg = { baseUrl: string; token: string };

function xprops() {
  const cid = loadSettings().plexClientId || 'web-client';
  const platform = navigator.userAgent.includes('Firefox') ? 'Firefox' : (navigator.userAgent.includes('Chrome') ? 'Chrome' : (navigator.userAgent.includes('Safari') ? 'Safari' : 'Web'));
  const verMatch = navigator.userAgent.match(/(Firefox|Chrome|Version)\/([\d\.]+)/);
  const version = verMatch ? verMatch[2] : '1.0.0';
  const res = `${window.screen.width}x${window.screen.height}`;
  return {
    'X-Plex-Product': 'Web Player',
    'X-Plex-Version': '0.1.0',
    'X-Plex-Client-Identifier': cid,
    'X-Plex-Platform': platform,
    'X-Plex-Platform-Version': version,
    'X-Plex-Device': platform,
    'X-Plex-Device-Name': platform,
    'X-Plex-Device-Screen-Resolution': res,
    'X-Plex-Language': 'en',
  };
}

export function plexTranscodeMp4Url(cfg: PlexCfg, ratingKey: string, opts?: { maxVideoBitrate?: number; autoAdjustQuality?: boolean; videoResolution?: string }) {
  const qp = new URLSearchParams();
  qp.set('path', `/library/metadata/${ratingKey}`);
  qp.set('protocol', 'http');
  qp.set('fastSeek', '1');
  qp.set('directPlay', '0');
  qp.set('directStream', '1');
  qp.set('directStreamAudio', '1');
  qp.set('subtitleSize', '100');
  qp.set('audioBoost', '100');
  if (opts?.autoAdjustQuality) qp.set('autoAdjustQuality', '1');
  if (opts?.maxVideoBitrate) qp.set('maxVideoBitrate', String(opts.maxVideoBitrate));
  if (opts?.videoResolution) qp.set('videoResolution', opts.videoResolution);
  const xp = xprops();
  Object.entries(xp).forEach(([k, v]) => qp.set(k, String(v)));
  const base = cfg.baseUrl.replace(/\/$/, '');
  qp.set('X-Plex-Token', cfg.token);
  return `${base}/video/:/transcode/universal/start.mp4?${qp.toString()}`;
}

export function plexTranscodeDashUrl(cfg: PlexCfg, ratingKey: string, opts?: { maxVideoBitrate?: number; autoAdjustQuality?: boolean; videoResolution?: string }) {
  const qp = new URLSearchParams();
  qp.set('path', `/library/metadata/${ratingKey}`);
  qp.set('protocol', 'dash');
  qp.set('fastSeek', '1');
  qp.set('directPlay', '0');
  qp.set('directStream', '1');
  qp.set('directStreamAudio', '1');
  qp.set('subtitleSize', '100');
  qp.set('audioBoost', '100');
  qp.set('manifestSubtitles', '1');
  if (opts?.autoAdjustQuality) qp.set('autoAdjustQuality', '1'); else qp.set('autoAdjustQuality', '0');
  if (opts?.maxVideoBitrate) qp.set('maxVideoBitrate', String(opts.maxVideoBitrate));
  if (opts?.videoResolution) qp.set('videoResolution', opts.videoResolution);
  const xp = xprops();
  Object.entries(xp).forEach(([k, v]) => qp.set(k, String(v)));
  const base = cfg.baseUrl.replace(/\/$/, '');
  qp.set('X-Plex-Token', cfg.token);
  return `${base}/video/:/transcode/universal/start.mpd?${qp.toString()}`;
}

export async function plexTimeline(cfg: PlexCfg, ratingKey: string, durationMs: number, timeMs: number, state: 'playing'|'paused'|'buffering') {
  try {
    const qp = new URLSearchParams();
    qp.set('ratingKey', ratingKey);
    qp.set('key', `/library/metadata/${ratingKey}`);
    qp.set('duration', String(Math.max(0, Math.floor(durationMs))));
    qp.set('time', String(Math.max(0, Math.floor(timeMs))));
    qp.set('state', state);
    const cid = loadSettings().plexClientId || 'web-client';
    qp.set('X-Plex-Client-Identifier', cid);
    qp.set('X-Plex-Token', cfg.token);
    const url = `${cfg.baseUrl.replace(/\/$/, '')}/:/timeline?${qp.toString()}`;
    await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } }).catch(()=>{});
  } catch {}
}

export async function plexMetadataWithMarkers(cfg: PlexCfg, ratingKey: string) {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/library/metadata/${ratingKey}?includeMarkers=1&X-Plex-Token=${cfg.token}`;
  return cached(`plex:${encodeURIComponent(cfg.baseUrl)}:meta_markers:${ratingKey}`, 60 * 60 * 1000, async () => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Plex markers fetch failed');
    return res.json();
  });
}
