import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { loadSettings, saveSettings } from '@/state/settings';
import { forget } from '@/services/cache';
import { refreshPlexServers } from '@/services/plextv_auth';

const items = [
  { to: '/', label: 'Home' },
  { to: '/library?tab=tv', label: 'TV Shows' },
  { to: '/library?tab=movies', label: 'Movies' },
  { to: '/library?tab=new', label: 'New & Popular' },
  { to: '/library?tab=mylist', label: 'My List' },
  { to: '/library?tab=langs', label: 'Browse by Languages' },
];

export default function TopNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [servers, setServers] = useState<Array<{ name: string; clientIdentifier: string; bestUri: string; token: string }>>([]);
  const [current, setCurrent] = useState<{ name: string } | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const s = loadSettings();
    if (s.plexServer) setCurrent({ name: s.plexServer.name });
    if (s.plexServers) setServers(s.plexServers);
  }, []);

  // Track scroll and drive background fade with rAF for smoothness
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    let current = 0; // start transparent; fade based on scroll on all pages
    let target = current;
    let rafId: number | null = null;

    const setVars = (v: number) => {
      el.style.setProperty('--nav-bg-o', String(0.85 * v));
      el.style.setProperty('--nav-blur', `${10 * v}px`);
    };
    setVars(current);

    const animate = () => {
      current += (target - current) * 0.18;
      if (Math.abs(target - current) < 0.005) {
        current = target;
        setVars(current);
        rafId = null;
        return;
      }
      setVars(current);
      rafId = requestAnimationFrame(animate);
    };

    const onScroll = () => {
      const y = window.scrollY || 0;
      target = Math.min(1, y / 120);
      if (rafId == null) rafId = requestAnimationFrame(animate);
    };
    // initialize based on current scroll
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true } as any);
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [pathname]);

  async function doRefresh() {
    const list = await refreshPlexServers();
    setServers(list);
    saveSettings({ plexServers: list });
  }
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div ref={headerRef} className="relative h-16">
        <div className="nav-bg" />
        <div className="page-gutter h-16 flex items-center gap-8 relative z-10">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-brand">NETFLIX</Link>
          <nav className="hidden md:flex gap-6 text-sm text-neutral-300">
            {items.map((it) => (
              <NavLink key={it.label} to={it.to} active={it.to === '/' ? pathname === '/' : pathname.startsWith('/library')}>
                {it.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-neutral-300">
            <IconSearch />
            <span className="hidden md:block text-xs">Kids</span>
            <IconBell />
            {/* Server switcher */}
            <div className="relative hidden md:block">
              <button className="btn" onClick={() => setOpen(v=>!v)}>{current?.name || 'Server'}</button>
              {open && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg ring-1 ring-white/10 bg-black/80 backdrop-blur p-2 z-50">
                  <div className="text-xs text-neutral-400 px-2 py-1">Servers</div>
                  <div className="max-h-60 overflow-auto">
                    {servers.map((s, i) => (
                      <button key={i} className="w-full text-left px-2 py-1 rounded hover:bg-white/10" onClick={()=>{
                        // Persist new server and clear Plex caches
                        saveSettings({ plexServer: { name: s.name, clientIdentifier: s.clientIdentifier, baseUrl: s.bestUri, token: s.token }, plexBaseUrl: s.bestUri, plexToken: s.token });
                        forget('plex:');
                        setCurrent({ name: s.name }); setOpen(false);
                        // Notify app to refresh Plex-backed views
                        window.dispatchEvent(new CustomEvent('plex-server-changed', { detail: { name: s.name, baseUrl: s.bestUri } }));
                      }}>{s.name}</button>
                    ))}
                    {servers.length===0 && <div className="px-2 py-1 text-neutral-400">No servers</div>}
                  </div>
                  <div className="border-t border-white/10 mt-2 pt-2 flex justify-between">
                    <button className="text-sm hover:text-white" onClick={doRefresh}>Refresh</button>
                    <Link to="/settings" className="text-sm hover:text-white" onClick={()=> setOpen(false)}>Settings</Link>
                  </div>
                </div>
              )}
            </div>
            <Link to="/settings" className="hidden md:inline-flex items-center gap-1 text-sm hover:text-white">
              <IconCog />
              <span>Settings</span>
            </Link>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-400 to-emerald-400" />
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, children, active }: { to: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link to={to} className={`hover:text-white transition-colors ${active ? 'text-white' : ''}`}>{children}</Link>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 21l-4.3-4.3"/><circle cx="11" cy="11" r="7"/></svg>
  );
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .53-.21 1.04-.59 1.41L4 17h5"/><path d="M9 21h6"/></svg>
  );
}

function IconCog() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 20.91 11H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
    </svg>
  );
}
