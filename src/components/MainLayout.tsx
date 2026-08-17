import { Outlet, Link } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

/** Layout com navegação lateral (desktop) e inferior (mobile). Usado nas rotas
 *  públicas e, via PrivateRoute, também nas protegidas. */
export const MainLayout = () => (
  <div className="flex flex-col md:flex-row min-h-screen bg-background w-full">
    <Sidebar />
    <main className="flex-1 w-full max-w-7xl mx-auto px-0 md:px-8 py-6 relative overflow-x-hidden">
      <Outlet />
      <footer className="px-5 pb-28 md:pb-6 pt-2 text-center text-[11px] text-textMuted space-y-1">
        <p>
          Suporte:{' '}
          <a href="mailto:contato.atchei@gmail.com" className="text-primary hover:underline">
            contato.atchei@gmail.com
          </a>
          {' · '}
          <a href="https://instagram.com/atchei.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            @atchei.app
          </a>
        </p>
        <p>
          <Link to="/termos" className="hover:underline">Termos de Uso</Link>
          {' · '}
          <Link to="/privacidade" className="hover:underline">Política de Privacidade</Link>
        </p>
      </footer>
    </main>
    <BottomNav />
  </div>
);
