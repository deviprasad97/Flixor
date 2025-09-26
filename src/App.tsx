import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import TopNav from '@/components/TopNav';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isPlayerRoute = location.pathname.includes('/player/');
  const isDetailsRoute = location.pathname.includes('/details/');
  const isHome = location.pathname === '/';

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/search');
      }
      // ESC to go back from search
      if (e.key === 'Escape' && location.pathname === '/search') {
        e.preventDefault();
        navigate(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Global fixed background layer */}
      <div className="app-bg-fixed bg-home-gradient" />
      {!isPlayerRoute && <TopNav />}
      <main className={`flex-1 ${!isPlayerRoute && !isHome && !isDetailsRoute ? 'pt-16' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
