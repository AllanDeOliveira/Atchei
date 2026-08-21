import { useEffect, useState } from 'react';
import { Share, X, HelpCircle, Download } from 'lucide-react';
import { Modal } from './ui/Modal';

// O evento `beforeinstallprompt` (Chrome/Android) não faz parte dos tipos padrão do DOM
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let promptCapturado: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptCapturado = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('pwa-instalavel'));
  });
}

export const DISMISS_KEY = '@chain:install-dismissed';

/**
 * Pop-up flutuante para adicionar o app à tela inicial (PWA), com o mesmo design do aviso de cookies.
 * Exibido no primeiro acesso (mobile e desktop) acima da barra inferior.
 */
export const InstallAppCard = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(promptCapturado);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(DISMISS_KEY) === '1' : false;
    } catch {
      return false;
    }
  });
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    const onInstalavel = () => setInstallEvent(promptCapturado);
    window.addEventListener('pwa-instalavel', onInstalavel);
    return () => window.removeEventListener('pwa-instalavel', onInstalavel);
  }, []);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true);

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  // Não exibe se já estiver instalado em modo standalone ou dispensado pelo usuário
  if (dismissed || isStandalone) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // localStorage indisponível
    }
    setDismissed(true);
    setShowGuideModal(false);
  };

  const instalar = async () => {
    if (installEvent) {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      promptCapturado = null;
      setInstallEvent(null);
      if (outcome === 'accepted') dismiss();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {/* Pop-up Flutuante Inferior (mesmo formato visual do banner de cookies) */}
      <aside
        role="region"
        aria-label="Adicionar à tela inicial"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 left-4 right-4 md:left-6 md:right-auto md:max-w-md z-[99997] surface rounded-3xl border border-glassBorder shadow-2xl p-5 md:p-6 text-left animate-in fade-in slide-in-from-bottom-4 duration-300"
      >
        <div className="mb-2">
          <h2 className="text-base font-display font-bold text-textLight">
            Adicione o Atchei à tela inicial
          </h2>
        </div>

        <p className="text-xs md:text-sm text-textMuted leading-relaxed">
          {isIos && !installEvent ? (
            <>
              Abra o Atchei como um app no seu celular! Toque em{' '}
              <Share size={12} className="inline -mt-0.5 text-primary" aria-label="Compartilhar" /> e selecione{' '}
              <strong className="text-textLight">"Adicionar à Tela de Início"</strong>.
            </>
          ) : (
            'Tenha acesso rápido aos seus eventos e ingressos, receba novidades e aproveite a melhor experiência direto do seu celular, como um app.'
          )}
        </p>

        <div className="flex gap-2.5 mt-4 pt-1">
          <button
            onClick={instalar}
            className="flex-1 bg-primary text-textDark font-sans font-bold text-xs md:text-sm py-2.5 px-4 rounded-xl hover:bg-primaryHover active:scale-95 transition-all cursor-pointer text-center shadow-md shadow-primary/20 flex items-center justify-center gap-1.5"
          >
            <Download size={15} />
            {isIos && !installEvent ? 'Como instalar' : 'Instalar app'}
          </button>
          <button
            onClick={dismiss}
            className="flex-1 bg-surface border border-glassBorder text-textLight font-sans font-semibold text-xs md:text-sm py-2.5 px-4 rounded-xl hover:bg-surfaceHover active:scale-95 transition-all cursor-pointer text-center"
          >
            Agora não
          </button>
        </div>
      </aside>

      {/* Modal Guia de Instalação */}
      <Modal
        open={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        labelledBy="install-guide-title"
        backdropClassName="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        className="surface border border-glassBorder rounded-2xl shadow-2xl max-w-sm w-full p-6 text-left relative"
      >
            <div className="flex items-center justify-between pb-3 border-b border-glassBorder">
              <h2 id="install-guide-title" className="text-base font-display font-bold text-textLight flex items-center gap-2">
                <HelpCircle size={18} className="text-primary" /> Como instalar o Atchei
              </h2>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-textMuted hover:text-textLight p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Fechar guia"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 my-4 text-xs text-textMuted leading-relaxed">
              <div className="p-3 rounded-xl bg-surface/50 border border-glassBorder">
                <p className="font-semibold text-textLight mb-1">No Google Chrome / Android:</p>
                <p>1. Toque nos <strong>3 pontinhos (⋮)</strong> no canto superior do navegador.</p>
                <p>2. Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
              </div>

              <div className="p-3 rounded-xl bg-surface/50 border border-glassBorder">
                <p className="font-semibold text-textLight mb-1">No Safari / iPhone (iOS):</p>
                <p>1. Toque no botão de <strong>Compartilhar <Share size={12} className="inline text-primary" /></strong>.</p>
                <p>2. Role e toque em <strong>"Adicionar à Tela de Início"</strong>.</p>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-textDark text-xs font-bold hover:bg-primaryHover transition-all cursor-pointer text-center"
            >
              Entendido
            </button>
      </Modal>
    </>
  );
};
