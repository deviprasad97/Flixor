import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { VideoSeekSlider } from 'react-video-seek-slider';
import PlexVideoPlayer from './PlexVideoPlayer';
import '../styles/player.css';
import {
  PlexConfig,
  plexMetadata,
  plexPlayQueue,
  plexImage,
} from '@/services/plex';
import {
  plexStreamUrl,
  plexTimelineUpdate,
  plexUniversalDecision,
  plexUpdateAudioStream,
  plexUpdateSubtitleStream,
  plexTranscodeImageUrl,
  plexDirectPlayUrl,
  plexStopTranscodeSession,
  plexKillAllTranscodeSessions,
} from '@/services/plex_player';
import {
  canDirectPlay,
  canDirectStream,
  getQualityOptions,
  getStreamDecision,
  getSubtitleOptions,
  getAudioOptions,
  getExternalSubtitleUrl,
} from '@/services/plex_decision';

interface PlayerMarker {
  type: 'intro' | 'credits' | 'commercial';
  startTimeOffset: number;
  endTimeOffset: number;
  final?: boolean;
}

interface Stream {
  id: string;
  index: number;
  streamType: number; // 1: video, 2: audio, 3: subtitle
  codec?: string;
  language?: string;
  languageCode?: string;
  languageTag?: string;
  selected?: boolean;
  default?: boolean;
  forced?: boolean;
  displayTitle?: string;
  extendedDisplayTitle?: string;
}

interface Media {
  id: string;
  duration: number;
  bitrate: number;
  width: number;
  height: number;
  videoResolution: string;
  videoCodec: string;
  audioCodec: string;
  container: string;
  Part: Array<{
    id: string;
    key: string;
    duration: number;
    size: number;
    indexes?: boolean;
    Stream: Stream[];
  }>;
}

interface PlexMetadata {
  ratingKey: string;
  key: string;
  guid: string;
  type: 'movie' | 'episode';
  title: string;
  grandparentTitle?: string;
  parentTitle?: string;
  grandparentRatingKey?: string;
  parentRatingKey?: string;
  contentRating?: string;
  summary?: string;
  index?: number;
  parentIndex?: number;
  year?: number;
  thumb?: string;
  art?: string;
  duration: number;
  viewOffset?: number;
  viewCount?: number;
  Marker?: PlayerMarker[];
  Media?: Media[];
  librarySectionID?: string;
}

interface AdvancedPlayerProps {
  plexConfig: PlexConfig;
  itemId: string;
  onBack?: () => void;
  onNext?: (nextId: string) => void;
}

const QUALITY_LEVELS = {
  '4k': [
    { label: '4K High (40 Mbps)', value: 40000 },
    { label: '4K Medium (30 Mbps)', value: 30000 },
    { label: '4K Low (20 Mbps)', value: 20000 },
    { label: '1080p High (20 Mbps)', value: 20000 },
    { label: '1080p Medium (12 Mbps)', value: 12000 },
    { label: '1080p Low (10 Mbps)', value: 10000 },
    { label: '720p High (4 Mbps)', value: 4000 },
    { label: '720p Medium (3 Mbps)', value: 3000 },
    { label: '720p Low (2 Mbps)', value: 2000 },
    { label: '480p (1.5 Mbps)', value: 1500 },
    { label: '360p (0.75 Mbps)', value: 750 },
    { label: '240p (0.3 Mbps)', value: 300 },
  ],
  '1080': [
    { label: '1080p High (20 Mbps)', value: 20000 },
    { label: '1080p Medium (12 Mbps)', value: 12000 },
    { label: '1080p Low (10 Mbps)', value: 10000 },
    { label: '720p High (4 Mbps)', value: 4000 },
    { label: '720p Medium (3 Mbps)', value: 3000 },
    { label: '720p Low (2 Mbps)', value: 2000 },
    { label: '480p (1.5 Mbps)', value: 1500 },
    { label: '360p (0.75 Mbps)', value: 750 },
    { label: '240p (0.3 Mbps)', value: 300 },
  ],
  '720': [
    { label: '720p High (4 Mbps)', value: 4000 },
    { label: '720p Medium (3 Mbps)', value: 3000 },
    { label: '720p Low (2 Mbps)', value: 2000 },
    { label: '480p (1.5 Mbps)', value: 1500 },
    { label: '360p (0.75 Mbps)', value: 750 },
    { label: '240p (0.3 Mbps)', value: 300 },
  ],
};

export default function AdvancedPlayer({ plexConfig, itemId, onBack, onNext }: AdvancedPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seekSliderRef = useRef<any>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 15));
  
  const [metadata, setMetadata] = useState<PlexMetadata | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Playback state
  const [playing, setPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('player_volume');
    return saved ? parseFloat(saved) : 1;
  });
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // UI state
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'quality' | 'audio' | 'subtitles'>('quality');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  
  // Quality settings
  const [quality, setQuality] = useState<string | number>(() => {
    const saved = localStorage.getItem('player_quality');
    // Parse as number if it's a numeric string, otherwise keep as string
    if (saved && saved !== 'original' && !isNaN(Number(saved))) {
      return Number(saved);
    }
    return saved || 'original';
  });
  
  // Stream selections
  const [selectedAudioStream, setSelectedAudioStream] = useState<string | null>(null);
  const [selectedSubtitleStream, setSelectedSubtitleStream] = useState<string | null>('0');
  const [qualityOptions, setQualityOptions] = useState<any[]>([]);
  const [audioOptions, setAudioOptions] = useState<any[]>([]);
  const [subtitleOptions, setSubtitleOptions] = useState<any[]>([]);
  
  // Play queue
  const [playQueue, setPlayQueue] = useState<PlexMetadata[]>([]);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState<number | null>(null);
  
  // Timeline update interval
  const timelineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load metadata and initialize player
  useEffect(() => {
    if (!itemId) return;
    
    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load metadata
        const metaResponse = await plexMetadata(plexConfig, itemId);
        const meta = metaResponse.MediaContainer.Metadata[0] as PlexMetadata;
        setMetadata(meta);
        
        // Get quality, audio, and subtitle options
        const qualOpts = getQualityOptions(meta);
        const audioOpts = getAudioOptions(meta);
        const subOpts = getSubtitleOptions(meta);
        
        setQualityOptions(qualOpts);
        setAudioOptions(audioOpts);
        setSubtitleOptions(subOpts);
        
        // Set default selections
        const defaultAudio = audioOpts.find((a: any) => a.selected || a.default);
        if (defaultAudio) setSelectedAudioStream(defaultAudio.id);
        
        const defaultSub = subOpts.find(s => s.selected);
        setSelectedSubtitleStream(defaultSub ? defaultSub.id : '0');
        
        // Determine stream decision
        const decision = getStreamDecision(meta, {
          quality: quality,
          directPlay: quality === 'original',
          audioStreamId: selectedAudioStream || undefined,
          subtitleStreamId: selectedSubtitleStream || undefined,
        });

        // Call decision API to see what Plex will actually do
        const plexDecision = await plexUniversalDecision(plexConfig, itemId, {
          maxVideoBitrate: quality === 'original' ? undefined : Number(quality),
          protocol: 'dash', // Use DASH like Plex Web for better codec support
          autoAdjustQuality: false,
          directPlay: decision.directPlay,
          directStream: decision.directStream,
          audioStreamID: selectedAudioStream || undefined,
          subtitleStreamID: selectedSubtitleStream || undefined,
        });

        // console.log('Initial Plex decision:', plexDecision);

        // Generate stream URL based on actual Plex decision
        let url: string;
        if (plexDecision.canDirectPlay && meta.Media?.[0]?.Part?.[0]?.key) {
          // Direct play URL
          url = plexDirectPlayUrl(plexConfig, meta.Media[0].Part[0].key);
          // console.log('Using direct play based on Plex decision');
        } else {
          // Transcode URL with actual Plex decision
          url = plexStreamUrl(plexConfig, itemId, {
            maxVideoBitrate: quality === 'original' ? undefined : Number(quality),
            protocol: 'dash', // Use DASH for better codec support
            autoAdjustQuality: false,
            directPlay: false,
            directStream: plexDecision.willDirectStream || false,
            audioStreamID: selectedAudioStream || undefined,
            subtitleStreamID: selectedSubtitleStream || undefined,
          });
          // console.log('Using stream URL with Plex decision:', {
          //   quality,
          //   willDirectStream: plexDecision.willDirectStream,
          //   willTranscode: plexDecision.willTranscode,
          // });
        }

        // console.log('Final stream URL:', url);
        // console.log('Metadata:', meta);
        setStreamUrl(url);
        
        // Load play queue for episodes
        if (meta.type === 'episode') {
          try {
            const queue = await plexPlayQueue(plexConfig, itemId);
            if (queue.MediaContainer?.Metadata) {
              setPlayQueue(queue.MediaContainer.Metadata);
            }
          } catch (err) {
            console.warn('Failed to load play queue:', err);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Failed to load content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
        setLoading(false);
      }
    };
    
    loadContent();
  }, [itemId, plexConfig]);

  // Timeline updates
  useEffect(() => {
    if (!metadata || !duration) return;
    
    const updateTimeline = () => {
      const state = buffering ? 'buffering' : playing ? 'playing' : 'paused';
      plexTimelineUpdate(
        plexConfig,
        metadata.ratingKey,
        currentTime * 1000,
        duration * 1000,
        state
      ).catch(console.warn);
    };
    
    // Initial update
    updateTimeline();
    
    // Set up interval
    timelineIntervalRef.current = setInterval(updateTimeline, 5000);
    
    return () => {
      if (timelineIntervalRef.current) {
        clearInterval(timelineIntervalRef.current);
      }
    };
  }, [metadata, currentTime, duration, playing, buffering, plexConfig]);

  // Ping interval - removed as not needed based on NevuForPlex

  // Controls auto-hide
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (playing) {
        timeout = setTimeout(() => setShowControls(false), 3000);
      }
    };
    
    const handleMouseLeave = () => {
      if (playing) {
        timeout = setTimeout(() => setShowControls(false), 1000);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    containerRef.current?.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      containerRef.current?.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timeout);
    };
  }, [playing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video) {
            if (playing) {
              video.pause();
            } else {
              video.play().catch(err => console.warn('Play failed:', err));
            }
          }
          setPlaying(p => !p);
          break;
        case 'ArrowLeft':
        case 'j':
          video.currentTime = Math.max(0, currentTime - 10);
          break;
        case 'ArrowRight':
        case 'l':
          video.currentTime = Math.min(duration, currentTime + 10);
          break;
        case 'ArrowUp':
          setVolume(v => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          setVolume(v => Math.max(0, v - 0.1));
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          setVolume(v => v > 0 ? 0 : 1);
          break;
        case 's':
          skipCurrentMarker();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentTime, duration]);

  // Volume persistence
  useEffect(() => {
    localStorage.setItem('player_volume', volume.toString());
  }, [volume]);

  // Quality change handler
  const handleQualityChange = useCallback(async (newQuality: string | number) => {
    if (!metadata || !itemId) return;

    try {
      const currentPos = currentTime;
      setQuality(newQuality);
      localStorage.setItem('player_quality', newQuality.toString());

      // Stop existing transcode session before starting new one
      // console.log('Stopping existing transcode sessions before quality change...');
      await plexKillAllTranscodeSessions(plexConfig);

      // Determine stream decision
      const decision = getStreamDecision(metadata, {
        quality: newQuality,
        directPlay: newQuality === 'original',
        audioStreamId: selectedAudioStream || undefined,
        subtitleStreamId: selectedSubtitleStream || undefined,
      });

      // First, call decision API to see what Plex will actually do
      const plexDecision = await plexUniversalDecision(plexConfig, itemId, {
        maxVideoBitrate: newQuality === 'original' ? undefined : Number(newQuality),
        protocol: 'dash', // Use DASH for better codec support
        autoAdjustQuality: false,
        directPlay: decision.directPlay,
        directStream: decision.directStream,
        audioStreamID: selectedAudioStream || undefined,
        subtitleStreamID: selectedSubtitleStream || undefined,
      });

      // console.log('Plex actual decision:', plexDecision);

      // Generate new stream URL based on actual Plex decision
      let url: string;
      if (plexDecision.canDirectPlay && metadata.Media?.[0]?.Part?.[0]?.key) {
        url = plexDirectPlayUrl(plexConfig, metadata.Media[0].Part[0].key);
        // console.log('Using direct play based on Plex decision');
      } else {
        const bitrateValue = newQuality === 'original' ? undefined : Number(newQuality);
        // console.log('Quality change request:', {
        //   newQuality,
        //   bitrateValue,
        //   plexDecision,
        //   currentStreamUrl: streamUrl,
        // });

        // Use actual Plex decision values
        url = plexStreamUrl(plexConfig, itemId, {
          maxVideoBitrate: bitrateValue,
          protocol: 'dash', // Use DASH for better codec support
          autoAdjustQuality: false,
          directPlay: false, // Plex already decided not to direct play
          directStream: plexDecision.willDirectStream || false,
          audioStreamID: selectedAudioStream || undefined,
          subtitleStreamID: selectedSubtitleStream || undefined,
          forceReload: true,
        });
        // console.log('Generated stream URL based on Plex decision:', url);
      }
      
      setStreamUrl(url);
      
      // Store position to restore after reload
      setTimeout(() => {
        const video = videoRef.current;
        if (video && currentPos > 0) {
          video.currentTime = currentPos;
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to change quality:', err);
    }
  }, [metadata, currentTime, plexConfig, itemId, selectedAudioStream, selectedSubtitleStream]);

  // Audio stream change
  const handleAudioStreamChange = useCallback(async (streamId: string) => {
    if (!metadata?.Media?.[0]?.Part?.[0]) return;
    
    try {
      const partId = metadata.Media[0].Part[0].id;
      await plexUpdateAudioStream(plexConfig, partId, streamId);
      setSelectedAudioStream(streamId);
      
      // Reload stream
      const currentPos = currentTime;
      const decision = getStreamDecision(metadata, {
        quality: quality,
        directPlay: quality === 'original',
        audioStreamId: streamId,
        subtitleStreamId: selectedSubtitleStream || undefined,
      });
      
      const url = plexStreamUrl(plexConfig, itemId, {
        maxVideoBitrate: quality === 'original' ? undefined : Number(quality),
        protocol: 'hls',
        autoAdjustQuality: false,
        directPlay: decision.directPlay,
        directStream: decision.directStream,
        audioStreamID: streamId,
        subtitleStreamID: selectedSubtitleStream || undefined,
        forceReload: true,
      });
      setStreamUrl(url);
      
      setTimeout(() => {
        const video = videoRef.current;
        if (video && currentPos > 0) {
          video.currentTime = currentPos;
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to change audio stream:', err);
    }
  }, [metadata, currentTime, quality, plexConfig, itemId]);

  // Subtitle stream change
  const handleSubtitleStreamChange = useCallback(async (streamId: string) => {
    if (!metadata?.Media?.[0]?.Part?.[0]) return;
    
    try {
      const partId = metadata.Media[0].Part[0].id;
      await plexUpdateSubtitleStream(plexConfig, partId, streamId);
      setSelectedSubtitleStream(streamId);
      
      // Reload stream
      const currentPos = currentTime;
      const decision = getStreamDecision(metadata, {
        quality: quality,
        directPlay: quality === 'original',
        audioStreamId: selectedAudioStream || undefined,
        subtitleStreamId: streamId,
      });
      
      const url = plexStreamUrl(plexConfig, itemId, {
        maxVideoBitrate: quality === 'original' ? undefined : Number(quality),
        protocol: 'hls',
        autoAdjustQuality: false,
        directPlay: decision.directPlay,
        directStream: decision.directStream,
        audioStreamID: selectedAudioStream || undefined,
        subtitleStreamID: streamId,
        forceReload: true,
      });
      setStreamUrl(url);
      
      setTimeout(() => {
        const video = videoRef.current;
        if (video && currentPos > 0) {
          video.currentTime = currentPos;
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to change subtitle stream:', err);
    }
  }, [metadata, currentTime, quality, plexConfig, itemId]);

  // Skip current marker
  const skipCurrentMarker = useCallback(() => {
    if (!metadata?.Marker || !videoRef.current) return;
    
    const marker = metadata.Marker.find(m => 
      currentTime * 1000 >= m.startTimeOffset &&
      currentTime * 1000 <= m.endTimeOffset
    );
    
    if (marker) {
      if (marker.type === 'credits' && marker.final && playQueue[1]) {
        // Skip to next episode
        onNext?.(playQueue[1].ratingKey);
      } else {
        // Skip past the marker
        videoRef.current.currentTime = (marker.endTimeOffset / 1000) + 1;
      }
    }
  }, [metadata, currentTime, playQueue, onNext]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Next episode countdown
  useEffect(() => {
    if (!metadata?.type || metadata.type !== 'episode') return;
    if (!playQueue[1]) return;
    if (!duration || currentTime < duration - 30) {
      setNextEpisodeCountdown(null);
      return;
    }
    
    if (nextEpisodeCountdown === null) {
      setNextEpisodeCountdown(10);
    }
  }, [metadata, playQueue, duration, currentTime, nextEpisodeCountdown]);

  useEffect(() => {
    if (nextEpisodeCountdown === null || nextEpisodeCountdown <= 0) return;
    
    const timer = setTimeout(() => {
      if (nextEpisodeCountdown === 1 && playQueue[1]) {
        onNext?.(playQueue[1].ratingKey);
      } else {
        setNextEpisodeCountdown(c => (c ?? 0) - 1);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [nextEpisodeCountdown, playQueue, onNext]);

  // Get current marker
  const currentMarker = metadata?.Marker?.find(m =>
    currentTime * 1000 >= m.startTimeOffset &&
    currentTime * 1000 <= m.endTimeOffset
  );

  // Format time
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Memoized callbacks for player - must be defined before any conditional returns
  const handleTimeUpdate = useCallback((time: number, dur: number) => {
    setCurrentTime(time);
    if (dur && dur > 0) setDuration(dur);
  }, []);

  const handleReady = useCallback(() => {
    // console.log('Player ready');
    setBuffering(false);
  }, []);

  const handleEnded = useCallback(() => {
    if (playQueue[1]) {
      onNext?.(playQueue[1].ratingKey);
    } else if (metadata) {
      plexTimelineUpdate(plexConfig, metadata.ratingKey, duration * 1000, duration * 1000, 'stopped');
      onBack?.();
    }
  }, [playQueue, metadata, duration, plexConfig, onNext, onBack]);

  const handleError = useCallback((err: string) => {
    console.error('Player error:', err);
    setError(err);
  }, []);

  const handleBuffering = useCallback((isBuffering: boolean) => {
    setBuffering(isBuffering);
  }, []);

  const handlePlayingChange = useCallback((isPlaying: boolean) => {
    setPlaying(isPlaying);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="mb-4">Error: {error}</div>
          <div className="mb-2 text-xs max-w-2xl break-all">
            Stream URL: {streamUrl}
          </div>
          <div className="flex gap-2 justify-center">
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              onClick={() => window.open(streamUrl, '_blank')}
            >
              Test URL
            </button>
            <button
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
              onClick={onBack}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use the options from state that were set during metadata load
  const canPlayDirect = metadata ? canDirectPlay(metadata) : false;
  const canStreamDirect = metadata ? canDirectStream(metadata) : false;

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-50">
      {streamUrl && (
        <div className="absolute inset-0">
          <PlexVideoPlayer
            key={streamUrl} // Force remount when URL changes
            src={streamUrl}
            poster={metadata?.thumb ? plexImage(plexConfig.baseUrl, plexConfig.token, metadata.thumb) : undefined}
            videoRef={videoRef}
            playing={playing}
            volume={volume}
            playbackRate={playbackRate}
            autoPlay={true}
            startTime={metadata?.viewOffset ? metadata.viewOffset / 1000 : undefined}
            onTimeUpdate={handleTimeUpdate}
            onReady={handleReady}
            onEnded={handleEnded}
            onError={handleError}
            onBuffering={handleBuffering}
            onPlayingChange={handlePlayingChange}
          />
        </div>
      )}

      {/* Buffering indicator */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Skip marker button */}
      {currentMarker && (
        <div className="absolute bottom-32 right-8 z-20">
          <button
            className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur rounded-lg text-white font-medium transition-all"
            onClick={skipCurrentMarker}
          >
            Skip {currentMarker.type === 'intro' ? 'Intro' : currentMarker.type === 'credits' ? 'Credits' : 'Marker'}
          </button>
        </div>
      )}

      {/* Next episode countdown */}
      {nextEpisodeCountdown !== null && playQueue[1] && (
        <div className="absolute bottom-32 right-8 z-20">
          <div className="bg-black/80 backdrop-blur rounded-lg p-4 max-w-sm">
            <div className="text-white mb-2">
              Up Next • Playing in {nextEpisodeCountdown}s
            </div>
            <div className="text-white/80 font-medium mb-3">
              {playQueue[1].title}
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded text-white"
                onClick={() => setNextEpisodeCountdown(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
                onClick={() => onNext?.(playQueue[1].ratingKey)}
              >
                Play Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-6">
          <div className="flex items-center gap-4">
            <button
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              onClick={() => {
                plexTimelineUpdate(plexConfig, metadata!.ratingKey, currentTime * 1000, duration * 1000, 'stopped');
                onBack?.();
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="text-white">
              <div className="text-2xl font-bold">
                {metadata?.type === 'episode' 
                  ? `${metadata.grandparentTitle} - S${metadata.parentIndex}E${metadata.index}`
                  : metadata?.title}
              </div>
              {metadata?.type === 'episode' && (
                <div className="text-white/80">{metadata.title}</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Seek bar */}
            <div className="mb-4 h-12">
              <VideoSeekSlider
                max={duration * 1000}
                currentTime={currentTime * 1000}
                bufferTime={buffered * 1000}
                onChange={(time: number) => {
                  const video = videoRef.current;
                  if (video) video.currentTime = time / 1000;
                }}
                offset={0}
                secondsPrefix="00:00:"
                minutesPrefix="00:"
                getPreviewScreenUrl={metadata?.Media?.[0]?.Part?.[0]?.indexes ? (time: number) => {
                  const partId = metadata.Media![0].Part[0].id;
                  return plexTranscodeImageUrl(plexConfig, `/library/parts/${partId}/indexes/sd/${Math.floor(time)}`, 320, 180);
                } : undefined}
              />
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) {
                      if (playing) {
                        video.pause();
                      } else {
                        video.play().catch(e => console.warn('Play failed:', e));
                      }
                    }
                    setPlaying(!playing);
                  }}
                >
                  {playing ? (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Skip buttons */}
                <button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) video.currentTime = Math.max(0, currentTime - 10);
                  }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                  </svg>
                </button>
                <button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => {
                    const video = videoRef.current;
                    if (video) video.currentTime = Math.min(duration, currentTime + 10);
                  }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                  </svg>
                </button>

                {/* Volume */}
                <div className="relative">
                  <button
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                  >
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      {volume === 0 ? (
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      ) : volume < 0.5 ? (
                        <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                      ) : (
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      )}
                    </svg>
                  </button>
                  {showVolumeSlider && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-black/90 rounded-lg p-3">
                      <div className="h-24 w-8 relative">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={volume * 100}
                          onChange={(e) => setVolume(parseInt(e.target.value) / 100)}
                          className="absolute h-24 w-2 appearance-none bg-white/20 rounded-full outline-none cursor-pointer"
                          style={{ 
                            writingMode: 'vertical-lr' as any, 
                            WebkitAppearance: 'slider-vertical',
                            transform: 'translateX(-50%)',
                            left: '50%'
                          }}
                        />
                      </div>
                      <div className="text-xs text-center mt-1 text-white/60">
                        {Math.round(volume * 100)}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Time display */}
                <div className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Settings */}
                <div className="relative">
                  <button
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  
                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 w-80 bg-black/95 backdrop-blur rounded-lg overflow-hidden">
                      <div className="flex border-b border-white/10">
                        <button
                          className={`flex-1 px-4 py-2 text-sm ${settingsTab === 'quality' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
                          onClick={() => setSettingsTab('quality')}
                        >
                          Quality
                        </button>
                        <button
                          className={`flex-1 px-4 py-2 text-sm ${settingsTab === 'audio' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
                          onClick={() => setSettingsTab('audio')}
                        >
                          Audio
                        </button>
                        <button
                          className={`flex-1 px-4 py-2 text-sm ${settingsTab === 'subtitles' ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
                          onClick={() => setSettingsTab('subtitles')}
                        >
                          Subtitles
                        </button>
                      </div>
                      
                      <div className="max-h-64 overflow-y-auto">
                        {settingsTab === 'quality' && (
                          <div className="p-2">
                            {qualityOptions.map((option) => (
                              <button
                                key={option.value}
                                className={`w-full text-left px-3 py-2 rounded hover:bg-white/10 transition-colors ${
                                  (quality === option.value || (typeof quality === 'number' && typeof option.value === 'number' && quality === option.value)) ? 'text-red-500' : 'text-white'
                                }`}
                                onClick={() => {
                                  handleQualityChange(option.value);
                                  setShowSettings(false);
                                }}
                              >
                                {option.label}
                                {option.value === 'original' && canPlayDirect && (
                                  <span className="text-xs text-white/60 ml-2">(Direct Play)</span>
                                )}
                                {option.value === 'original' && !canPlayDirect && (
                                  <span className="text-xs text-white/60 ml-2">(Direct Stream/Original)</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {settingsTab === 'audio' && (
                          <div className="p-2">
                            {audioOptions.length === 0 ? (
                              <div className="text-white/60 text-center py-4">No audio tracks available</div>
                            ) : (
                              audioOptions.map((option) => (
                                <button
                                  key={option.id}
                                  className={`w-full text-left px-3 py-2 rounded hover:bg-white/10 transition-colors ${
                                    selectedAudioStream === option.id ? 'text-red-500' : 'text-white'
                                  }`}
                                  onClick={() => {
                                    handleAudioStreamChange(option.id);
                                    setShowSettings(false);
                                  }}
                                >
                                  {option.title}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                        
                        {settingsTab === 'subtitles' && (
                          <div className="p-2">
                            {subtitleOptions.map((option) => (
                              <button
                                key={option.id}
                                className={`w-full text-left px-3 py-2 rounded hover:bg-white/10 transition-colors ${
                                  selectedSubtitleStream === option.id ? 'text-red-500' : 'text-white'
                                }`}
                                onClick={() => {
                                  handleSubtitleStreamChange(option.id);
                                  setShowSettings(false);
                                }}
                              >
                                {option.title}
                                {option.forced && <span className="text-xs text-white/60 ml-2">(Forced)</span>}
                                {option.external && <span className="text-xs text-white/60 ml-2">(External)</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Playback speed */}
                <select
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded transition-colors"
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>

                {/* Fullscreen */}
                <button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={toggleFullscreen}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}