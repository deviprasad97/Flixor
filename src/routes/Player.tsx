import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PlayerChrome from '@/components/PlayerChrome';
import { loadSettings } from '@/state/settings';
import { plexMetadata } from '@/services/plex';

// IPC to Tauri commands (stubbed for web preview)
async function tauriInvoke<T = any>(cmd: string, args?: Record<string, any>): Promise<T> {
  // @ts-ignore
  if (window.__TAURI__) {
    // @ts-ignore
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke(cmd, args);
  }
  // Web fallback: simulate
  return Promise.resolve({} as T);
}

export default function Player() {
  const { id } = useParams();
  const loc = useLocation();
  const nav = useNavigate();
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(3600);
  const qs = useMemo(()=> new URLSearchParams(loc.search), [loc.search]);

  useEffect(() => {
    async function open() {
      if (!id) return;
      const decoded = decodeURIComponent(id);
      let url: string | undefined;
      if (decoded.startsWith('plex:')) {
        const s = loadSettings();
        if (s.plexBaseUrl && s.plexToken) {
          const rk = decoded.replace(/^plex:/, '');
          try {
            const meta: any = await plexMetadata({ baseUrl: s.plexBaseUrl!, token: s.plexToken! }, rk);
            const m = meta?.MediaContainer?.Metadata?.[0];
            const v = qs.get('v');
            let partId: string | undefined;
            if (v) {
              const media = (m?.Media||[]).find((me:any)=> String(me.id||me.Id)===v);
              partId = media?.Part?.[0]?.id ? String(media.Part[0].id) : undefined;
            } else {
              partId = m?.Media?.[0]?.Part?.[0]?.id ? String(m.Media[0].Part[0].id) : undefined;
            }
            if (partId) url = `${s.plexBaseUrl!.replace(/\/$/, '')}/library/parts/${partId}/stream?X-Plex-Token=${s.plexToken}`;
          } catch (e) { console.error(e); }
        }
      }
      // Fallback: sample
      if (!url) url = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;
      tauriInvoke('player_open', { url }).catch(() => {});
    }
    open();
  }, [id]);

  return (
    <div className="fixed inset-0 bg-black">
      {/* Video surface is rendered natively by mpv/libmpv. This view is control chrome. */}
      <PlayerChrome
        title={`Playing ${id}`}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onBack={() => { tauriInvoke('player_stop').finally(() => nav(-1)); }}
        onPlayPause={() => { setIsPlaying((p) => !p); tauriInvoke(isPlaying ? 'player_pause' : 'player_play'); }}
        onSeek={(t) => { setCurrentTime(t); tauriInvoke('player_seek', { seconds: t }); }}
      />
    </div>
  );
}
