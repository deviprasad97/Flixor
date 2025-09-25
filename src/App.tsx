import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '@/components/TopNav';

export default function App() {
  const location = useLocation();
  const isPlayerRoute = location.pathname.includes('/player/');
  const isDetailsRoute = location.pathname.includes('/details/');
  const isHome = location.pathname === '/';

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
