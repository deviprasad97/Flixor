import { Outlet } from 'react-router-dom';
import TopNav from '@/components/TopNav';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
