import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, ShieldCheck, BarChart3, Check } from 'lucide-react';
import { COOKIE_CONSENT_KEY, aplicarConsentimento } from '../lib/firebase';
import { Modal } from './ui/Modal';
import { useInstallCardPending } from '../hooks/useInstallCardPending';

/** Aviso de cookies para TODO visitante (logado ou não): quem chega por link de evento
 *  é a maior parte do público, e é dele que vêm as métricas. */
export const CookieBanner = () => {
  const [escolha, setEscolha] = useState<string | null>(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(COOKIE_CONSENT_KEY) : null;
    } catch {
      return null;
    }
  });

  const [showModal, setShowModal] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  // O convite de "adicionar à tela inicial" vem primeiro: os dois pop-ups dividem a
  // mesma posição, e antes o de cookies cobria o outro. O modal de preferências
  // (aberto pelo rodapé) não é afetado — só o banner espera a vez.
  const installCardPending = useInstallCardPending();

  const lerEscolha = () => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(COOKIE_CONSENT_KEY) : null;
    } catch {
      return null;
    }
  };

  // Escuta evento para reabrir preferências a partir do rodapé
  useEffect(() => {
    const handleOpenPreferences = () => {
      const saved = lerEscolha();
      setAnalyticsChecked(saved === 'all');
      setShowModal(true);
    };

    window.addEventListener('atchei:open-cookie-preferences', handleOpenPreferences);
    return () => {
      window.removeEventListener('atchei:open-cookie-preferences', handleOpenPreferences);
    };
  }, []);

  const salvarDecisao = (valor: 'all' | 'essential') => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, valor);
    } catch {
      // localStorage indisponível (modo anônimo restrito)
    }
    aplicarConsentimento(valor === 'all');
    setEscolha(valor);
    setShowModal(false);
    // Sinaliza que a decisão foi tomada — o InstallAppCard espera por isso para entrar em cena.
    window.dispatchEvent(new Event('atchei:cookies-decididos'));
  };

  const salvarPreferencias = () => {
    salvarDecisao(analyticsChecked ? 'all' : 'essential');
  };

  const openAdminModal = () => {
    const saved = lerEscolha();
    setAnalyticsChecked(saved ? saved === 'all' : true);
    setShowModal(true);
  };

  return (
    <>
      {/* Banner Principal (Estilo Canva - apenas para usuários logados) */}
      {!escolha && !showModal && !installCardPending && (
        <aside
          role="region"
          aria-label="Aviso de cookies"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 left-4 right-4 md:left-6 md:right-auto md:max-w-lg z-[99998] surface rounded-2xl border border-glassBorder shadow-2xl p-5 md:p-6 text-left animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-base font-display font-bold text-textLight flex items-center gap-2">
              Primeiro, vamos falar dos cookies
            </h2>
          </div>

          <p className="text-xs md:text-sm text-textMuted leading-relaxed">
            Utilizamos cookies essenciais para o funcionamento do Atchei. Gostaríamos de usar outros cookies para melhorar e
            personalizar a sua experiência e analisar o desempenho do nosso site, mas somente se você permitir. Para saber mais
            sobre suas opções, consulte a nossa{' '}
            <Link to="/privacidade" className="text-accent hover:underline font-medium underline-offset-2">
              Política de Privacidade
            </Link>.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mt-4 pt-1">
            <button
              onClick={() => salvarDecisao('all')}
              className="bg-primary text-textDark font-sans font-bold text-xs md:text-sm py-2.5 px-4 rounded-xl hover:bg-primaryHover active:scale-95 transition-all cursor-pointer text-center shadow-md shadow-primary/20"
            >
              Aceitar todos os cookies
            </button>
            <button
              onClick={openAdminModal}
              className="bg-transparent hover:bg-white/5 border border-glassBorder text-textLight font-sans font-semibold text-xs md:text-sm py-2.5 px-4 rounded-xl active:scale-95 transition-all cursor-pointer text-center"
            >
              Administrar cookies
            </button>
          </div>
        </aside>
      )}

      {/* Modal de Administração de Preferências */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        labelledBy="cookie-modal-title"
        backdropClassName="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        className="surface border border-glassBorder rounded-2xl shadow-2xl max-w-lg w-full p-6 text-left relative max-h-[90vh] flex flex-col"
      >
            <div className="flex items-center justify-between pb-3 border-b border-glassBorder">
              <div>
                <h2 id="cookie-modal-title" className="text-lg font-display font-bold text-textLight">
                  Preferências de cookies
                </h2>
                <p className="text-xs text-textMuted mt-0.5">
                  Gerencie quais categorias de cookies você autoriza.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-textMuted hover:text-textLight p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Fechar modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 my-4 overflow-y-auto pr-1">
              {/* Cookies Essenciais */}
              <div className="p-3.5 rounded-xl bg-surface/50 border border-glassBorder flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
                  <ShieldCheck size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-textLight">Cookies essenciais</span>
                  </div>
                  <p className="text-xs text-textMuted mt-1 leading-relaxed">
                    Indispensáveis para o funcionamento da plataforma, login, autenticação segura e proteção contra fraudes (reCAPTCHA / App Check).
                  </p>
                </div>
              </div>

              {/* Cookies Analíticos (Google Analytics) */}
              <div className="p-3.5 rounded-xl bg-surface/50 border border-glassBorder flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-accent mt-0.5">
                  <BarChart3 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-textLight">Cookies analíticos (GA4)</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={analyticsChecked}
                        onChange={(e) => setAnalyticsChecked(e.target.checked)}
                        className="sr-only peer"
                        aria-label="Permitir cookies analíticos"
                      />
                      <div className="w-10 h-5 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <p className="text-xs text-textMuted mt-1 leading-relaxed">
                    Ajudam a entender como o app é utilizado para melhorarmos recursos. Com o <strong>Google Consent Mode v2</strong>, se desativado, o envio é totalmente anônimo e sem armazenamento de cookies.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-glassBorder flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                onClick={() => salvarDecisao('essential')}
                className="py-2.5 px-4 rounded-xl border border-glassBorder hover:bg-white/5 text-xs font-semibold text-textMuted hover:text-textLight transition-all cursor-pointer text-center"
              >
                Apenas essenciais
              </button>
              <button
                onClick={salvarPreferencias}
                className="py-2.5 px-4 rounded-xl bg-primary text-textDark text-xs font-bold hover:bg-primaryHover transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
              >
                <Check size={14} /> Salvar preferências
              </button>
            </div>
      </Modal>
    </>
  );
};
