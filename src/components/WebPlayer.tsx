import { useEffect, useRef, useState } from 'react';

export default function WebPlayer({
  src,
  title,
  onBack,
  poster,
  startTime,
  quality,
  qualityOptions,
  onQualityChange,
  markers,
  onProgress,
  dash,
  nextLabel,
  onNext,
  resolution,
  resolutionOptions,
  onResolutionChange,
}: {
  src: string;
  title?: string;
  poster?: string;
  onBack?: () => void;
  startTime?: number; // seconds
  quality?: string;
  qualityOptions?: Array<{ label: string; value: string }>;
  onQualityChange?: (v: string) => void;
  markers?: Array<{ type: string; start: number; end: number }>;
  onProgress?: (t: number, d: number, state: 'playing'|'paused'|'buffering') => void;
  dash?: boolean; // if true, treat src as DASH manifest
  nextLabel?: string;
  onNext?: () => void;
  resolution?: string;
  resolutionOptions?: Array<{ label: string; value: string }>;
  onResolutionChange?: (v: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showUi, setShowUi] = useState(true);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const dashRef = useRef<any>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => { setDuration(v.duration || 0); if (startTime && isFinite(startTime)) { try { v.currentTime = startTime; } catch {} } };
    const onTime = () => { setTime(v.currentTime || 0); onProgress?.(v.currentTime||0, v.duration||0, playing?'playing':'paused'); };
    const onProg = () => {
      try { const b = v.buffered?.length ? v.buffered.end(v.buffered.length - 1) : 0; setBuffered(b); } catch {}
    };
    const onPlay = () => { setPlaying(true); onProgress?.(v.currentTime||0, v.duration||0, 'playing'); };
    const onPause = () => { setPlaying(false); onProgress?.(v.currentTime||0, v.duration||0, 'paused'); };
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('progress', onProg);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', () => setError('Playback failed'));
    v.addEventListener('waiting', () => onProgress?.(v.currentTime||0, v.duration||0, 'buffering'));
    v.addEventListener('ended', () => { if (!autoCanceled) onNext?.(); });
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('progress', onProg);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', () => {});
      v.removeEventListener('waiting', () => {});
      v.removeEventListener('ended', () => {});
    };
  }, []);

  // DASH attach/detach
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!dash) return; // mp4 direct play
    // load dash.js from CDN if not present
    async function ensureDash() {
      // @ts-ignore
      if (window.dashjs) return (window as any).dashjs;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/dashjs@4.7.0/dist/dash.all.min.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('dash.js failed to load'));
        document.head.appendChild(s);
      });
      return (window as any).dashjs;
    }
    let player: any;
    (async () => {
      try {
        const dashjs = await ensureDash();
        player = dashjs.MediaPlayer().create();
        player.initialize(v, src, true);
        player.updateSettings({
          streaming: {
            abr: { autoSwitchBitrate: { video: true } },
            fastSwitchEnabled: true,
          },
        });
        dashRef.current = player;
      } catch (e) {
        console.error(e);
        setError('Failed to initialize player');
      }
    })();
    return () => {
      try { player?.reset?.(); } catch {}
      dashRef.current = null;
    };
  }, [src, dash]);

  useEffect(() => {
    const onMove = () => {
      setShowUi(true);
      window.clearTimeout((onMove as any)._t);
      (onMove as any)._t = window.setTimeout(() => setShowUi(false), 2500);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchstart', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchstart', onMove);
      window.clearTimeout((onMove as any)._t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current; if (!v) return;
      switch (e.key) {
        case ' ': e.preventDefault(); playing ? v.pause() : v.play(); break;
        case 'ArrowLeft': v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'ArrowRight': v.currentTime = Math.min(duration, v.currentTime + 10); break;
        case 'ArrowUp': v.volume = Math.min(1, Math.round((v.volume + 0.05)*100)/100); setVolume(v.volume); break;
        case 'ArrowDown': v.volume = Math.max(0, Math.round((v.volume - 0.05)*100)/100); setVolume(v.volume); break;
        case 'f': toggleFullscreen(); break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [playing, duration]);

  function togglePlay() {
    const v = videoRef.current; if (!v) return; playing ? v.pause() : v.play();
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen(); else document.exitFullscreen();
  }
  function onSeek(pct: number) {
    const v = videoRef.current; if (!v) return; v.currentTime = pct * (duration || 0); onProgress?.(v.currentTime||0, v.duration||0, playing?'playing':'paused');
  }
  function setVol(vl: number) {
    const v = videoRef.current; if (!v) return; const x = Math.max(0, Math.min(1, vl)); v.volume = x; setVolume(x);
  }
  function setPlaybackRate(r: number) {
    const v = videoRef.current; if (!v) return; v.playbackRate = r; setRate(r);
  }

  const pct = duration ? Math.max(0, Math.min(1, time / duration)) : 0;
  const pctBuf = duration ? Math.max(0, Math.min(1, buffered / duration)) : 0;
  const activeSkip = (markers||[]).find(m => (m.type||'').toLowerCase().includes('intro') && time >= m.start && time <= m.end);
  const nearEnd = duration>0 && time >= Math.max(0, duration - 30);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [autoCanceled, setAutoCanceled] = useState<boolean>(false);
  useEffect(() => { setCountdown(null); setAutoCanceled(false); }, [src]);
  useEffect(() => {
    if (!nextLabel || autoCanceled) return;
    if (!nearEnd) return;
    if (countdown !== null) return;
    setCountdown(10);
  }, [nearEnd, nextLabel, autoCanceled, countdown]);
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { setCountdown(null); onNext?.(); return; }
    const t = window.setTimeout(() => setCountdown((c)=> (c??0) - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        src={src}
        poster={poster}
        controls={false}
        autoPlay
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl ring-1 ring-white/10 bg-black/70 p-4 text-center text-neutral-200">
            <div className="mb-2">Unable to play this file in the browser.</div>
            <div className="flex gap-2 justify-center">
              <button className="btn" onClick={()=> window.open(src, '_blank')}>Open in new tab</button>
              <button className="btn" onClick={()=> { setError(null); const v=videoRef.current; v?.load(); v?.play().catch(()=>{}); }}>Retry</button>
            </div>
          </div>
        </div>
      )}
      {/* Top bar */}
      <div className={`absolute top-0 inset-x-0 p-3 transition-opacity ${showUi? 'opacity-100':'opacity-0'} bg-gradient-to-b from-black/60 to-transparent` }>
        <div className="max-w-6xl mx-auto flex items-center gap-3 text-neutral-200">
          <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={onBack}>Back</button>
          <div className="font-medium truncate">{title}</div>
        </div>
      </div>
      {/* Center play */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${showUi? 'opacity-100':'opacity-0'}`}>
        <button className="pointer-events-auto px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white" onClick={togglePlay}>{playing?'Pause':'Play'}</button>
      </div>
      {/* Skip intro */}
      {activeSkip && (
        <div className="absolute bottom-24 right-6">
          <button className="px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm" onClick={()=>{ const v=videoRef.current; if(!v) return; v.currentTime=Math.min(v.duration, activeSkip.end + 0.5); }}>Skip Intro</button>
        </div>
      )}
      {/* Bottom controls */}
      <div className={`absolute bottom-0 inset-x-0 p-4 transition-opacity ${showUi? 'opacity-100':'opacity-0'} bg-gradient-to-t from-black/70 to-transparent`}>
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="h-2 rounded bg-white/15 overflow-hidden group">
            <div className="h-full bg-white/20" style={{ width: `${pctBuf*100}%` }} />
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(pct*1000)}
              onChange={(e)=> onSeek((Number(e.target.value)||0)/1000)}
              className="w-full h-2 appearance-none bg-transparent cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-200">
            <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={()=>{ const v=videoRef.current; if(!v) return; v.currentTime=Math.max(0,v.currentTime-10); }}>-10s</button>
            <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={togglePlay}>{playing?'Pause':'Play'}</button>
            <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={()=>{ const v=videoRef.current; if(!v) return; v.currentTime=Math.min(duration,v.currentTime+10); }}>+10s</button>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-neutral-300">Vol</span>
            <input type="range" min={0} max={100} value={Math.round(volume*100)} onChange={(e)=> setVol((Number(e.target.value)||0)/100)} />
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-neutral-300">Speed</span>
            <select className="bg-white/10 rounded px-2 py-1" value={rate} onChange={(e)=> setPlaybackRate(Number(e.target.value)||1)}>
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={1.75}>1.75x</option>
              <option value={2}>2x</option>
            </select>
          </div>
          {qualityOptions && qualityOptions.length>0 && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-neutral-300">Quality</span>
              <select className="bg-white/10 rounded px-2 py-1" value={quality} onChange={(e)=> onQualityChange?.(e.target.value)}>
                {qualityOptions.map((q)=> (<option key={q.value} value={q.value}>{q.label}</option>))}
              </select>
            </div>
          )}
          {resolutionOptions && resolutionOptions.length>0 && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-neutral-300">Resolution</span>
              <select className="bg-white/10 rounded px-2 py-1" value={resolution} onChange={(e)=> onResolutionChange?.(e.target.value)}>
                {resolutionOptions.map((r)=> (<option key={r.value} value={r.value}>{r.label}</option>))}
              </select>
            </div>
          )}
          <div className="ml-auto tabular-nums text-neutral-300">{fmt(time)} / {fmt(duration)}</div>
          <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/20" onClick={toggleFullscreen}>Full</button>
        </div>
        </div>
      </div>
      {/* Next episode prompt */}
      {nextLabel && (nearEnd || showUi) && (
        <div className="absolute bottom-24 right-6">
          <div className="rounded-xl bg-black/60 ring-1 ring-white/10 p-3 text-neutral-200">
            <div className="text-sm mb-2">Up Next {countdown!==null && <span className="text-neutral-400">• Playing in {countdown}s</span>}</div>
            <div className="font-medium mb-2 max-w-xs line-clamp-2">{nextLabel}</div>
            <div className="flex justify-end">
              {countdown!==null && (
                <button className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 mr-2" onClick={()=> { setAutoCanceled(true); setCountdown(null); }}>Cancel</button>
              )}
              <button className="px-3 py-1.5 rounded bg-white/20 hover:bg-white/30" onClick={()=> onNext?.()}>Play Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fmt(s?: number) {
  if (!s || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}
