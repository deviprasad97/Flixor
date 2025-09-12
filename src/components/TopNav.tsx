import { Link, useLocation } from 'react-router-dom';

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
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md">
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-transparent pointer-events-none" />
      <div className="relative border-b border-white/5">
        <div className="page-gutter py-3.5 flex items-center gap-8">
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
