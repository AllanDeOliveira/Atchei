import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

/** Layout com navegação lateral (desktop) e inferior (mobile). Usado nas rotas
 *  públicas e, via PrivateRoute, também nas protegidas. */
export const MainLayout = () => (
  <div className="flex flex-col md:flex-row min-h-screen bg-background w-full">
    <Sidebar />
    <main className="flex-1 w-full max-w-7xl mx-auto px-0 md:px-8 py-6 relative overflow-x-hidden">
      <Outlet />
    </main>
    <BottomNav />
  </div>
);
