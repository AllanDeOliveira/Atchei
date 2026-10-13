import { Outlet, Link } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { InstagramIcon } from './InstagramIcon';

/** Layout com navegação lateral (desktop) e inferior (mobile). Usado nas rotas
 *  públicas e, via PrivateRoute, também nas protegidas. */
export const MainLayout = () => (
  <div className="flex flex-col min-h-screen bg-background w-full">
    <div className="flex flex-col md:flex-row flex-1 w-full">
      <Sidebar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-0 md:px-8 py-6 relative overflow-x-hidden">
        <Outlet />
      </main>
    </div>
    <footer className="bg-stone-900 text-white/80 px-6 md:px-10 pt-10 pb-32 md:pb-10 text-left">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xs font-bold tracking-widest uppercase text-white mb-4">Institucional</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/quem-somos" className="hover:text-primary transition-colors">Quem somos</Link></li>
              <li><Link to="/termos" className="hover:text-primary transition-colors">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="hover:text-primary transition-colors">Política de Privacidade</Link></li>
              <li>
                {/* Reabre o modal de preferências de cookies (LGPD: consentimento revogável a qualquer momento). */}
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('atchei:open-cookie-preferences'));
                  }}
                  className="hover:text-primary transition-colors cursor-pointer"
                >
                  Preferências de cookies
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-widest uppercase text-white mb-4">Entre em contato</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                E-mail:{' '}
                <a href="mailto:contato.atchei@gmail.com" className="hover:text-primary transition-colors">
                  contato.atchei@gmail.com
                </a>
              </li>
              <li>
                <a
                  href={`mailto:contato.atchei@gmail.com?subject=${encodeURIComponent('Sugestão de melhoria — Atchei')}&body=${encodeURIComponent('Olá! Tenho uma sugestão para o Atchei:\n\n')}`}
                  className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
                >
                  <Lightbulb size={14} /> Sugerir melhoria
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-widest uppercase text-white mb-4">Redes sociais</h3>
            <a
              href="https://instagram.com/atchei.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-primary transition-colors text-sm"
            >
              <InstagramIcon size={18} /> @atchei.app
            </a>
          </div>
        </div>
        <p className="text-xs text-white/60 mt-8 pt-6 border-t border-white/10">
          © {new Date().getFullYear()} Atchei — Cáceres, MT
        </p>
      </div>
    </footer>
    <BottomNav />
  </div>
);
