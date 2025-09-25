import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '@/components/TopNav';

export default function App() {
  const location = useLocation();
  const isPlayerRoute = location.pathname.includes('/player/');
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      {!isPlayerRoute && <TopNav />}
      <main className={` bg-home-gradient flex-1`}>
        <Outlet />
      </main>
    </div>
  );
}
