import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import * as dashjs from 'dashjs';
import { VideoSeekSlider } from 'react-video-seek-slider';
import '../styles/player.css';

interface PlexVideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  onTimeUpdate?: (time: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
  onReady?: () => void;
  onBuffering?: (buffering: boolean) => void;
  startTime?: number;
  videoRef?: React.RefObject<HTMLVideoElement>;
  playing?: boolean;
  volume?: number;
  playbackRate?: number;
  onPlayingChange?: (playing: boolean) => void;
}

export default function PlexVideoPlayer({
  src,
  poster,
  autoPlay = true,
  onTimeUpdate,
  onEnded,
  onError,
  onReady,
  onBuffering,
  startTime,
  videoRef: externalVideoRef,
  playing = true,
  volume = 1,
  playbackRate = 1,
  onPlayingChange,
}: PlexVideoPlayerProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    console.log('PlexVideoPlayer: Setting up player for URL:', src);

    const setupPlayer = () => {
      // Reset ready state when setting up new player
      setIsReady(false);

      // Clean up previous HLS instance
      if (hlsRef.current) {
        console.log('Cleaning up previous HLS instance');
        try {
          hlsRef.current.stopLoad();
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch (e) {
          console.error('Error cleaning up HLS:', e);
        }
        hlsRef.current = null;
      }

      // Clean up previous DASH instance
      if (dashRef.current) {
        console.log('Cleaning up previous DASH instance');
        try {
          dashRef.current.reset();
        } catch (e) {
          console.error('Error cleaning up DASH:', e);
        }
        dashRef.current = null;
      }

      // Reset video element
      video.pause();
      video.removeAttribute('src');
      video.load();

      // Determine stream type
      const isDash = src.includes('.mpd');
      const isHls = src.includes('.m3u8');

      console.log('Stream type:', isDash ? 'DASH' : isHls ? 'HLS' : 'Direct');

      if (isDash) {
        // Use DASH.js for DASH streams
        console.log('Using DASH.js for:', src);
        const dash = dashjs.MediaPlayer().create();

        // Configure DASH player
        dash.updateSettings({
          streaming: {
            buffer: {
              bufferTimeAtTopQuality: 30,
              bufferPruningInterval: 10,
              bufferToKeep: 20,
              fastSwitchEnabled: true,
            },
            abr: {
              autoSwitchBitrate: {
                video: false, // We control quality manually
              },
            },
            retryIntervals: {
              MPD: 500,
            },
            retryAttempts: {
              MPD: 3,
            },
          },
          debug: {
            logLevel: 1, // 0=none, 1=error, 2=warning, 3=info, 4=debug
          },
        });

        // Initialize DASH player
        dash.initialize(video, src, autoPlay);

        // Handle DASH events
        dash.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, () => {
          console.log('DASH manifest loaded');
          if (!isReady) {
            setIsReady(true);
            onReady?.();
          }
        });

        dash.on(dashjs.MediaPlayer.events.ERROR, (e: any) => {
          console.error('DASH error:', e);
          if (e.error && e.error.message) {
            onError?.(`DASH Error: ${e.error.message}`);
          }
        });

        dash.on(dashjs.MediaPlayer.events.BUFFER_EMPTY, () => {
          onBuffering?.(true);
        });

        dash.on(dashjs.MediaPlayer.events.BUFFER_LOADED, () => {
          onBuffering?.(false);
        });

        dashRef.current = dash;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        console.log('Using native HLS support');
        video.src = src;
        video.load();
      } else if (Hls.isSupported()) {
        // Use HLS.js for other browsers
        console.log('Using HLS.js for:', src);
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          maxBufferSize: 60 * 1000 * 1000, // 60 MB
          maxBufferHole: 0.5,
          startLevel: -1, // Auto
          xhrSetup: (xhr: XMLHttpRequest, url: string) => {
            // Add credentials for CORS
            xhr.withCredentials = false;
          },
        });

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest parsed');
          if (!isReady) {
            setIsReady(true);
            onReady?.();
          }
          if (autoPlay) {
            video.play().catch(e => console.warn('Autoplay failed:', e));
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          // Don't log non-fatal errors unless they're important
          if (data.fatal || data.details === 'bufferStalledError') {
            console.error('HLS error:', event, data);
          }
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Fatal network error, trying to recover');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Fatal media error, trying to recover');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal error, cannot recover');
                onError?.(`HLS Error: ${data.details}`);
                hls.destroy();
                break;
            }
          } else if (data.details === 'bufferStalledError') {
            // Handle buffer stall
            console.log('Buffer stalled, attempting recovery');
            hls.startLoad();
          }
        });

        hlsRef.current = hls;
      } else {
        // Fallback to direct playback
        console.log('HLS not supported, trying direct playback');
        video.src = src;
        video.load();
      }
    };

    setupPlayer();

    // Event listeners
    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded');
      if (!isReady) {
        setIsReady(true);
        onReady?.();
      }
      if (startTime && startTime > 0) {
        video.currentTime = startTime;
      }
      if (autoPlay) {
        video.play().catch(e => console.warn('Autoplay failed:', e));
      }
    };

    const handleTimeUpdate = () => {
      onTimeUpdate?.(video.currentTime, video.duration);
    };

    const handleEnded = () => {
      onEnded?.();
    };

    const handleError = (e: Event) => {
      const error = video.error;
      console.error('Video error:', error);
      onError?.(`Video error: ${error?.message || 'Unknown error'}`);
    };

    const handleWaiting = () => {
      onBuffering?.(true);
    };

    const handlePlaying = () => {
      onBuffering?.(false);
      onPlayingChange?.(true);
    };

    const handlePause = () => {
      onPlayingChange?.(false);
    };

    const handleSeeking = () => {
      onBuffering?.(true);
    };

    const handleSeeked = () => {
      onBuffering?.(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);

      if (hlsRef.current) {
        try {
          hlsRef.current.stopLoad();
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch (e) {
          console.error('Error cleaning up HLS on unmount:', e);
        }
        hlsRef.current = null;
      }

      if (dashRef.current) {
        try {
          dashRef.current.reset();
        } catch (e) {
          console.error('Error cleaning up DASH on unmount:', e);
        }
        dashRef.current = null;
      }

      // Clean video element
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [src, autoPlay, startTime, onTimeUpdate, onEnded, onError, onReady, onBuffering, onPlayingChange]);

  // Handle play/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    
    if (playing) {
      video.play().catch(e => console.warn('Play failed:', e));
    } else {
      video.pause();
    }
  }, [playing, isReady]);

  // Handle volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  // Handle playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain"
      poster={poster}
      playsInline
      controls={false} // We'll use custom controls
      crossOrigin="anonymous"
    />
  );
}