import { Outlet, useLocation } from 'react-router-dom';
import TopNav from '@/components/TopNav';

export default function App() {
  const location = useLocation();
  const isPlayerRoute = location.pathname.includes('/player/');

  return (
    <div className="min-h-screen flex flex-col">
      {!isPlayerRoute && <TopNav />}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
