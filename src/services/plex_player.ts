// Plex player-specific APIs based on NevuForPlex implementation
import { PlexConfig } from './plex';

// Generate a consistent client ID
function getClientId(): string {
  let clientId = localStorage.getItem('plex_client_id');
  if (!clientId) {
    clientId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('plex_client_id', clientId);
  }
  return clientId;
}

// Generate session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('plex_session_id');
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('plex_session_id', sessionId);
  }
  return sessionId;
}

// Get browser info
function getBrowserName(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
}

// Get client profile for codec capabilities
function getClientProfile(): string {
  // This tells Plex what codecs we support
  // Based on actual Plex Web client profile
  const profiles = [];
  
  // HEVC is not supported in most browsers
  profiles.push('add-limitation(scope=videoCodec&scopeName=hevc&type=upperBound&name=video.width&value=4096&replace=true)');
  profiles.push('add-limitation(scope=videoCodec&scopeName=hevc&type=upperBound&name=video.height&value=2160&replace=true)');
  profiles.push('add-limitation(scope=videoCodec&scopeName=hevc&type=upperBound&name=video.bitDepth&value=10&replace=true)');
  
  // Add transcode targets - prefer h264 for compatibility
  profiles.push('append-transcode-target-codec(type=videoProfile&context=streaming&protocol=dash&videoCodec=h264)');
  profiles.push('append-transcode-target-codec(type=videoProfile&context=streaming&protocol=hls&videoCodec=h264)');
  profiles.push('append-transcode-target-codec(type=videoProfile&context=streaming&videoCodec=h264,hevc&audioCodec=aac&protocol=dash)');
  
  // Color space limitations
  profiles.push('add-limitation(scope=videoTranscodeTarget&scopeName=hevc&scopeType=videoCodec&context=streaming&protocol=dash&type=match&name=video.colorTrc&list=bt709|bt470m|bt470bg|smpte170m|smpte240m|bt2020-10|smpte2084&isRequired=false)');
  
  return profiles.join('+');
}

// Build X-Plex headers
export function getXPlexHeaders(token: string) {
  return {
    'X-Plex-Product': 'Plex MPV Client',
    'X-Plex-Version': '1.0.0',
    'X-Plex-Client-Identifier': getClientId(),
    'X-Plex-Platform': 'Web',
    'X-Plex-Platform-Version': getBrowserName(),
    'X-Plex-Features': 'external-media,indirect-media,hub-style-list',
    'X-Plex-Model': 'bundled',
    'X-Plex-Device': getBrowserName(),
    'X-Plex-Device-Name': 'Plex MPV Web',
    'X-Plex-Device-Screen-Resolution': `${window.screen.width}x${window.screen.height}`,
    'X-Plex-Token': token,
    'X-Plex-Language': 'en',
    'X-Plex-Session-Id': getSessionId(),
    'X-Plex-Session-Identifier': getSessionId(),
    'X-Plex-Client-Profile-Extra': getClientProfile(),
  };
}

// Build stream properties (based on NevuForPlex getStreamProps)
export function getStreamProps(itemId: string, options?: {
  maxVideoBitrate?: number;
  autoAdjustQuality?: boolean;
  protocol?: 'dash' | 'hls';
  directPlay?: boolean;
  directStream?: boolean;
  audioStreamID?: string;
  subtitleStreamID?: string;
  subtitleMode?: 'burn' | 'embed' | 'none';
}) {
  const sessionId = getSessionId();
  
  const props: any = {
    hasMDE: 1,
    path: `/library/metadata/${itemId}`,
    mediaIndex: 0,
    partIndex: 0,
    protocol: options?.protocol || 'hls',
    fastSeek: 1,
    directPlay: options?.directPlay === true ? 1 : 0,
    directStream: options?.directStream === true ? 1 : 0,
    directStreamAudio: 0, // Set to 0 to allow audio transcoding when needed
    subtitleSize: 100,
    audioBoost: 100, // Can be increased to 700 like Plex Web
    location: 'lan',
    addDebugOverlay: 0,
    autoAdjustQuality: options?.autoAdjustQuality ? 1 : 0,
    mediaBufferSize: 102400,
    'Accept-Language': 'en',
    session: sessionId,
    'X-Plex-Incomplete-Segments': 1,
  };
  
  // Handle subtitles
  if (options?.subtitleStreamID !== undefined) {
    if (options.subtitleStreamID === '0' || options.subtitleStreamID === '-1') {
      // No subtitles
      props.subtitles = 'none';
    } else {
      props.subtitleStreamID = options.subtitleStreamID;
      props.subtitles = options.subtitleMode || 'burn';
    }
  } else {
    props.subtitles = 'burn';
  }
  
  // Handle audio stream
  if (options?.audioStreamID) {
    props.audioStreamID = options.audioStreamID;
  }
  
  // Only add bitrate if specified and not undefined
  if (options?.maxVideoBitrate !== undefined && options.maxVideoBitrate > 0) {
    props.maxVideoBitrate = options.maxVideoBitrate;
  }
  
  return props;
}

// Call Plex decision API to get actual playback decision
export async function plexUniversalDecision(cfg: PlexConfig, itemId: string, options?: {
  maxVideoBitrate?: number;
  autoAdjustQuality?: boolean;
  protocol?: 'dash' | 'hls';
  directPlay?: boolean;
  directStream?: boolean;
  audioStreamID?: string;
  subtitleStreamID?: string;
}) {
  const props = getStreamProps(itemId, {
    ...options,
    protocol: options?.protocol || 'hls',
  });
  const headers = getXPlexHeaders(cfg.token);

  // Build query params
  const params = new URLSearchParams();
  Object.entries(props).forEach(([key, value]) => {
    params.set(key, String(value));
  });
  Object.entries(headers).forEach(([key, value]) => {
    params.set(key, String(value));
  });

  const url = `${cfg.baseUrl}/video/:/transcode/universal/decision?${params}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Plex-Token': cfg.token,
      },
    });

    const data = await response.json();
    const container = data.MediaContainer;

    // Extract decision information
    const decision = {
      directPlayDecisionCode: container.directPlayDecisionCode,
      directPlayDecisionText: container.directPlayDecisionText,
      transcodeDecisionCode: container.transcodeDecisionCode,
      transcodeDecisionText: container.transcodeDecisionText,
      generalDecisionCode: container.generalDecisionCode,
      generalDecisionText: container.generalDecisionText,
      videoDecision: container.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.Stream?.[0]?.decision,
      audioDecision: container.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.Stream?.[1]?.decision,
    };

    console.log('Plex Decision:', decision);

    // Determine actual playback method based on decision codes
    const canDirectPlay = decision.directPlayDecisionCode === 1000;
    const willTranscode = decision.videoDecision === 'transcode';
    const willDirectStream = decision.videoDecision === 'copy';

    return {
      ...decision,
      canDirectPlay,
      willTranscode,
      willDirectStream,
      streamUrl: container.Metadata?.[0]?.Media?.[0]?.Part?.[0]?.key,
    };
  } catch (error) {
    console.error('Failed to get Plex decision:', error);
    // Return default decision on error
    return {
      canDirectPlay: false,
      willTranscode: true,
      willDirectStream: false,
    };
  }
}

// Get stream URL (based on NevuForPlex approach)
export function plexStreamUrl(cfg: PlexConfig, itemId: string, options?: {
  maxVideoBitrate?: number;
  protocol?: 'dash' | 'hls';
  autoAdjustQuality?: boolean;
  directPlay?: boolean;
  directStream?: boolean;
  audioStreamID?: string;
  subtitleStreamID?: string;
  forceReload?: boolean;
}) {
  const props = getStreamProps(itemId, {
    ...options,
    protocol: options?.protocol || 'hls',
  });
  
  // Generate new session if forcing reload (quality change)
  if (options?.forceReload) {
    // Clear old session to force new transcode
    sessionStorage.removeItem('plex_session_id');
  }
  
  const headers = getXPlexHeaders(cfg.token);
  
  // Build query params
  const params = new URLSearchParams();
  Object.entries(props).forEach(([key, value]) => {
    params.set(key, String(value));
  });
  Object.entries(headers).forEach(([key, value]) => {
    params.set(key, String(value));
  });
  
  // Add cache buster if forcing reload
  if (options?.forceReload) {
    params.set('_t', Date.now().toString());
  }
  
  const ext = options?.protocol === 'hls' ? 'm3u8' : 'mpd';
  const url = `${cfg.baseUrl}/video/:/transcode/universal/start.${ext}?${params}`;
  
  console.log('Generated stream URL with params:', {
    directPlay: props.directPlay,
    directStream: props.directStream,
    maxVideoBitrate: props.maxVideoBitrate,
    protocol: props.protocol,
    session: props.session,
  });
  
  return url;
}

// Get direct play URL for a part
export function plexDirectPlayUrl(cfg: PlexConfig, partKey: string) {
  const baseUrl = cfg.baseUrl.replace(/\/$/, '');
  const key = partKey.startsWith('/') ? partKey : `/${partKey}`;
  return `${baseUrl}${key}?X-Plex-Token=${cfg.token}`;
}

// Timeline update (based on NevuForPlex getTimelineUpdate)
export async function plexTimelineUpdate(cfg: PlexConfig, itemId: string, time: number, duration: number, state: 'playing' | 'paused' | 'stopped' | 'buffering') {
  const headers = getXPlexHeaders(cfg.token);
  const params = new URLSearchParams({
    ratingKey: itemId,
    key: `/library/metadata/${itemId}`,
    playbackTime: Math.floor(time).toString(),
    time: Math.floor(time).toString(),
    duration: Math.floor(duration).toString(),
    state,
    context: 'library',
    ...headers,
  });

  const url = `${cfg.baseUrl}/:/timeline?${params}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!res.ok) console.warn('Timeline update failed:', res.status);
  return res;
}

// Audio stream update (based on NevuForPlex putAudioStream)
export async function plexUpdateAudioStream(cfg: PlexConfig, partId: string, streamId: string) {
  const headers = getXPlexHeaders(cfg.token);
  const params = new URLSearchParams({
    audioStreamID: streamId,
    ...headers,
  });

  const url = `${cfg.baseUrl}/library/parts/${partId}?${params}`;
  const res = await fetch(url, { 
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!res.ok) throw new Error(`Failed to update audio stream: ${res.status}`);
  return res;
}

// Subtitle stream update (based on NevuForPlex putSubtitleStream)
export async function plexUpdateSubtitleStream(cfg: PlexConfig, partId: string, streamId: string) {
  const headers = getXPlexHeaders(cfg.token);
  const params = new URLSearchParams({
    subtitleStreamID: streamId,
    ...headers,
  });

  const url = `${cfg.baseUrl}/library/parts/${partId}?${params}`;
  const res = await fetch(url, { 
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!res.ok) throw new Error(`Failed to update subtitle stream: ${res.status}`);
  return res;
}

// Transcode image URL
export function plexTranscodeImageUrl(cfg: PlexConfig, path: string, width: number, height: number) {
  const params = new URLSearchParams({
    width: width.toString(),
    height: height.toString(),
    minSize: '1',
    upscale: '1',
    'X-Plex-Token': cfg.token,
  });
  
  return `${cfg.baseUrl}/photo/:/transcode?${params}&url=${encodeURIComponent(path)}`;
}