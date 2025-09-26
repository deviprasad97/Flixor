const PLEX_TV = 'https://plex.tv';

function hdrs(clientId: string) {
  const base: any = {
    'X-Plex-Product': 'MPV Plex Client',
    'X-Plex-Version': '1.0',
    'X-Plex-Client-Identifier': clientId,
    'X-Plex-Platform': navigator.platform || 'Web',
    'X-Plex-Device': 'Web',
    'X-Plex-Device-Name': 'Web',
    'Accept': 'application/json',
  };
  return base;
}

export async function createPin(clientId: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('plex_tv_pin_create', { clientId });
  }
  const res = await fetch(`${PLEX_TV}/api/v2/pins`, {
    method: 'POST',
    headers: hdrs(clientId),
  });
  if (!res.ok) throw new Error('Failed to create PIN');
  return res.json();
}

export async function pollPin(clientId: string, id: number) {
  // @ts-ignore
  if (window.__TAURI__) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('plex_tv_pin_poll', { clientId, pinId: id });
  }
  const res = await fetch(`${PLEX_TV}/api/v2/pins/${id}`, { headers: hdrs(clientId) });
  if (!res.ok) throw new Error('Failed to poll PIN');
  return res.json();
}

export async function getResources(accountToken: string, clientId: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('plex_tv_resources', { accountToken, clientId });
  }
  const h = { ...hdrs(clientId), 'X-Plex-Token': accountToken } as any;
  const res = await fetch(`${PLEX_TV}/api/v2/resources?includeHttps=1&includeRelay=1`, { headers: h });
  if (!res.ok) throw new Error('Failed to fetch resources');
  return res.json();
}

function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera')) return 'Opera';
  return 'Web';
}
function getBrowserVersion() {
  const ua = navigator.userAgent;
  const m = ua.match(/(Firefox|Chrome|Version)\/([\d\.]+)/);
  return m ? m[2] : '1.0';
}
function getOS() {
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS/.test(ua)) return 'MacOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Web';
}

export function buildAuthUrl(clientId: string, code: string, pinId: number) {
  const screen = `${window.screen.width}x${window.screen.height}`;
  const forward = encodeURIComponent(`${window.location.origin}/login?pinID=${pinId}&code=${code}`);
  const platform = getBrowserName();
  const platformVersion = getBrowserVersion();
  const device = getOS();
  const protocol = window.location.protocol.replace(':','');
  // Use bracketed context params expected by Plex
  return `https://app.plex.tv/auth/#!?clientID=${clientId}&code=${code}`+
    `&context[device][product]=Plex%20Web`+
    `&context[device][version]=4.120.0`+
    `&context[device][platform]=${encodeURIComponent(platform)}`+
    `&context[device][platformVersion]=${encodeURIComponent(platformVersion)}`+
    `&context[device][device]=${encodeURIComponent(device)}`+
    `&context[device][model]=bundled`+
    `&context[device][screenResolution]=${encodeURIComponent(screen)}`+
    `&context[device][layout]=desktop`+
    `&context[device][protocol]=${encodeURIComponent(protocol)}`+
    `&forwardUrl=${forward}&language=en`;
}

export function pickBestConnection(resource: any): { uri: string; token: string } | null {
  if (!resource?.connections) return null;
  const conns = resource.connections as Array<{ uri: string; local: boolean; relay: boolean; protocol: string }>;
  const token = resource.accessToken || resource.token;
  const pref = (c: any) => (c.protocol === 'https' ? 2 : 1) + (c.local ? 4 : 0) + (!c.relay ? 1 : 0);
  const best = [...conns].sort((a,b)=> pref(b)-pref(a))[0];
  if (!best) return null;
  return { uri: best.uri, token };
}

export async function refreshPlexServers(): Promise<Array<{ name: string; clientIdentifier: string; bestUri: string; token: string }>> {
  const { loadSettings } = await import('@/state/settings');
  const s = loadSettings();
  if (!s.plexAccountToken || !s.plexClientId) return [];
  const res: any = await getResources(s.plexAccountToken, s.plexClientId);
  const list = (res || []).filter((r: any) => r.product === 'Plex Media Server');
  const out: Array<{ name: string; clientIdentifier: string; bestUri: string; token: string }> = [];
  for (const srv of list) {
    const best = pickBestConnection(srv);
    if (best) out.push({ name: srv.name, clientIdentifier: srv.clientIdentifier, bestUri: best.uri, token: best.token });
  }
  return out;
}

export async function getUserProfile(accountToken: string, clientId: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('plex_tv_user', { accountToken, clientId });
  }
  const h = { ...hdrs(clientId), 'X-Plex-Token': accountToken } as any;
  const res = await fetch(`${PLEX_TV}/api/v2/user`, { headers: h });
  if (!res.ok) throw new Error('Failed to fetch user profile');
  return res.json();
}

export async function getUsers(accountToken: string, clientId: string) {
  // @ts-ignore
  if (window.__TAURI__) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('plex_tv_users', { accountToken, clientId });
  }
  const h = { ...hdrs(clientId), 'X-Plex-Token': accountToken } as any;
  const res = await fetch(`${PLEX_TV}/api/v2/users`, { headers: h });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}
