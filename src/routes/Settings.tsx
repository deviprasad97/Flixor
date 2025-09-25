import { useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '@/state/settings';
import { forget } from '@/services/cache';
import { createPin, pollPin, getResources, buildAuthUrl, pickBestConnection } from '@/services/plextv_auth';
import { TraktAuth } from '@/components/TraktAuth';

export default function Settings() {
  const initial = loadSettings();
  const [plexUrl, setPlexUrl] = useState(initial.plexBaseUrl || '');
  const [plexToken, setPlexToken] = useState(initial.plexToken || '');
  const [tmdbKey, setTmdbKey] = useState(initial.tmdbBearer || '');
  const [traktKey, setTraktKey] = useState(initial.traktClientId || '');
  const [plexTvToken, setPlexTvToken] = useState(initial.plexTvToken || '');
  const [tmdbStatus, setTmdbStatus] = useState<string>('');
  const [plexStatus, setPlexStatus] = useState<string>('');
  const [auth, setAuth] = useState<{pinId?: number; code?: string}>({});
  const [servers, setServers] = useState<any[]>([]);
  const [selectedServer, setSelectedServer] = useState<any>(initial.plexServer);

  useEffect(() => {
    const s = saveSettings({ plexBaseUrl: plexUrl, plexToken, tmdbBearer: tmdbKey, traktClientId: traktKey, plexTvToken });
  }, [plexUrl, plexToken, tmdbKey, traktKey, plexTvToken]);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto p-6 space-y-8 pt-6">
      <section>
        <h2 className="text-xl font-semibold mb-2">Accounts</h2>
        <div className="grid gap-3">
          {/* Plex authentication via PIN */}
          <div className="rounded-lg ring-1 ring-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-neutral-300">Plex Account</div>
                {selectedServer ? (
                  <div className="text-neutral-200 text-sm">Connected to {selectedServer?.name}</div>
                ) : initial.plexAccountToken ? (
                  <div className="text-neutral-400 text-sm">Authenticated. Select a server below.</div>
                ) : (
                  <div className="text-neutral-400 text-sm">Not signed in</div>
                )}
              </div>
              {!initial.plexAccountToken && !auth.pinId && (
                <button className="btn" onClick={async()=>{
                  const cid = initial.plexClientId || crypto.randomUUID();
                  saveSettings({ plexClientId: cid });
                  const pin:any = await createPin(cid);
                  setAuth({ pinId: pin.id, code: pin.code });
                }}>Sign in with Plex</button>
              )}
              {initial.plexAccountToken && (
                <button className="btn" onClick={async()=>{
                  const cid = loadSettings().plexClientId!;
                  const resources:any = await getResources(loadSettings().plexAccountToken!, cid);
                  const list = (resources || []).filter((r:any)=> r.product === 'Plex Media Server');
                  setServers(list);
                }}>Refresh Servers</button>
              )}
            </div>
            {auth.pinId && (
              <div className="mt-3 text-sm">
                <div className="mb-2">Enter this code at Plex: <span className="font-semibold text-white">{auth.code}</span></div>
                <div className="flex gap-2">
                  <button className="btn" onClick={()=> window.open(buildAuthUrl(loadSettings().plexClientId!, auth.code!), '_blank')}>Open Plex</button>
                  <button className="btn" onClick={async()=>{
                    const cid = loadSettings().plexClientId!;
                    const res:any = await pollPin(cid, auth.pinId!);
                    if (res?.authToken) {
                      saveSettings({ plexAccountToken: res.authToken });
                      setAuth({});
                      const resources:any = await getResources(res.authToken, cid);
                      const list = (resources || []).filter((r:any)=> r.product === 'Plex Media Server');
                      setServers(list);
                    }
                  }}>Poll</button>
                </div>
              </div>
            )}
            {servers.length>0 && (
              <div className="mt-3">
                <div className="text-sm mb-2">Select a server</div>
                <div className="grid gap-2">
                  {servers.map((s:any, idx:number)=>{
                    const best = pickBestConnection(s);
                    return (
                      <div key={idx} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                        <div className="text-neutral-200">{s.name || s.clientIdentifier}</div>
                        <div className="flex gap-2">
                          <button className="btn" onClick={async()=>{
                            if (!best) return;
                            saveSettings({ plexServer: { name: s.name, clientIdentifier: s.clientIdentifier, baseUrl: best.uri, token: best.token }, plexBaseUrl: best.uri, plexToken: best.token });
                            setSelectedServer({ name: s.name, clientIdentifier: s.clientIdentifier, baseUrl: best.uri, token: best.token });
                            // Clear Plex caches and notify app to refresh
                            forget('plex:');
                            window.dispatchEvent(new CustomEvent('plex-server-changed', { detail: { name: s.name, baseUrl: best.uri } }));
                          }}>Use</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Trakt Authentication */}
          <div className="mt-6">
            <TraktAuth
              onAuthComplete={() => {
                // Refresh the page or update state as needed
                window.dispatchEvent(new CustomEvent('trakt-auth-changed'));
              }}
              onAuthError={(error) => {
                console.error('Trakt auth error:', error);
              }}
            />
          </div>

          <L label="Plex URL"><input value={plexUrl} onChange={(e) => setPlexUrl(e.target.value)} placeholder="https://app.plex.tv" className="input" /></L>
          <L label="Plex Token"><input value={plexToken} onChange={(e) => setPlexToken(e.target.value)} placeholder="" className="input" /></L>
          <L label="TMDB API Key"><input value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} className="input" /></L>
          <L label="Plex Account Token (Watchlist)"><input value={plexTvToken} onChange={(e) => setPlexTvToken(e.target.value)} placeholder="Plex.tv account token" className="input" /></L>
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
          <div className="flex gap-3">
            <button className="btn" onClick={()=> { forget(''); alert('Cache cleared'); }}>Clear App Cache</button>
            <button className="btn" onClick={()=> { saveSettings({ plexAccountToken: undefined, plexServer: undefined }); alert('Signed out from Plex'); }}>Sign out of Plex</button>
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
