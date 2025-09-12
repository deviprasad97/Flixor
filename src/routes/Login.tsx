import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadSettings, saveSettings } from '@/state/settings';
import { createPin, pollPin, getResources, buildAuthUrl, pickBestConnection } from '@/services/plextv_auth';

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const pinIdParam = params.get('pinID');
  const codeParam = params.get('code');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const s = loadSettings();
    async function start() {
      try {
        const clientId = s.plexClientId || crypto.randomUUID();
        if (!s.plexClientId) saveSettings({ plexClientId: clientId });
        // If coming back from Plex with pinID&code → poll for token
        if (pinIdParam && codeParam) {
          setStatus('Authorizing with Plex…');
          const pinId = Number(pinIdParam);
          const start = Date.now();
          let authed: string | undefined;
          while (Date.now() - start < 120000) {
            const res: any = await pollPin(clientId, pinId);
            if (res?.authToken) { authed = res.authToken; break; }
            await new Promise(r => setTimeout(r, 3000));
          }
          if (!authed) { setStatus('Authorization timed out. Please try again.'); return; }
          saveSettings({ plexAccountToken: authed });
          setStatus('Loading servers…');
          const resources: any = await getResources(authed, clientId);
          const servers = (resources || []).filter((r: any) => r.product === 'Plex Media Server');
          if (servers.length) {
            const best = pickBestConnection(servers[0]);
            if (best) saveSettings({ plexServer: { name: servers[0].name, clientIdentifier: servers[0].clientIdentifier, baseUrl: best.uri, token: best.token }, plexBaseUrl: best.uri, plexToken: best.token });
          }
          nav('/');
          return;
        }
        // fresh start → create pin and redirect to Plex auth
        setStatus('Redirecting to Plex…');
        const pin: any = await createPin(clientId);
        window.location.href = buildAuthUrl(clientId, pin.code, pin.id);
      } catch (e: any) {
        setStatus('Login failed: ' + (e?.message || 'Unknown error'));
      }
    }
    start();
  }, [pinIdParam, codeParam]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-neutral-300">{status || 'Loading…'}</div>
    </div>
  );
}

