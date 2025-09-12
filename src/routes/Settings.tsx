import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '@/state/settings';

export default function Settings() {
  const initial = loadSettings();
  const [plexUrl, setPlexUrl] = useState(initial.plexBaseUrl || '');
  const [plexToken, setPlexToken] = useState(initial.plexToken || '');
  const [tmdbKey, setTmdbKey] = useState(initial.tmdbBearer || '');
  const [traktKey, setTraktKey] = useState(initial.traktClientId || '');
  const [plexTvToken, setPlexTvToken] = useState(initial.plexTvToken || '');
  const [tmdbStatus, setTmdbStatus] = useState<string>('');
  const [plexStatus, setPlexStatus] = useState<string>('');

  useEffect(() => {
    const s = saveSettings({ plexBaseUrl: plexUrl, plexToken, tmdbBearer: tmdbKey, traktClientId: traktKey, plexTvToken });
  }, [plexUrl, plexToken, tmdbKey, traktKey, plexTvToken]);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-2">Accounts</h2>
        <div className="grid gap-3">
          <L label="Plex URL"><input value={plexUrl} onChange={(e) => setPlexUrl(e.target.value)} placeholder="https://app.plex.tv" className="input" /></L>
          <L label="Plex Token"><input value={plexToken} onChange={(e) => setPlexToken(e.target.value)} placeholder="" className="input" /></L>
          <L label="TMDB API Key"><input value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} className="input" /></L>
          <L label="Plex Account Token (Watchlist)"><input value={plexTvToken} onChange={(e) => setPlexTvToken(e.target.value)} placeholder="Plex.tv account token" className="input" /></L>
          <L label="Trakt Client ID"><input value={traktKey} onChange={(e) => setTraktKey(e.target.value)} className="input" /></L>
          <div className="flex gap-3 pt-2">
            <button className="btn" onClick={async () => {
              setTmdbStatus('Testing…');
              try {
                const { tmdbTrending } = await import('@/services/tmdb');
                await tmdbTrending(tmdbKey, 'tv', 'day');
                setTmdbStatus('TMDB OK');
              } catch (e: any) {
                setTmdbStatus('TMDB failed: ' + (e?.message || 'error'));
              }
            }}>Test TMDB</button>
            <span className="text-sm text-neutral-400">{tmdbStatus}</span>
          </div>
          <div className="flex gap-3">
            <button className="btn" onClick={async () => {
              setPlexStatus('Testing…');
              try {
                const { plexLibs } = await import('@/services/plex');
                await plexLibs({ baseUrl: plexUrl, token: plexToken });
                setPlexStatus('Plex OK');
              } catch (e: any) {
                setPlexStatus('Plex failed: ' + (e?.message || 'error'));
              }
            }}>Test Plex</button>
            <span className="text-sm text-neutral-400">{plexStatus}</span>
          </div>
        </div>
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">Playback</h2>
        <div className="grid gap-3">
          <L label="MPV Profile">
            <select className="input">
              <option>Direct Play</option>
              <option>Transcode (H264/AAC)</option>
            </select>
          </L>
          <L label="HDR to SDR Tone-map">
            <select className="input">
              <option>auto</option>
              <option>bt.2390</option>
              <option>hable</option>
            </select>
          </L>
        </div>
      </section>
    </div>
  );
}

function L({ label, children }: { label: string; children: any }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

// (styled via Tailwind utility classes in src/styles/index.css)
