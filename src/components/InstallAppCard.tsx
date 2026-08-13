import { useEffect, useState } from 'react';
import { Smartphone, Share, X } from 'lucide-react';

// O evento `beforeinstallprompt` (Chrome/Android) não faz parte dos tipos do DOM.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// O Chrome dispara `beforeinstallprompt` uma única vez, logo no boot — antes de
// qualquer componente montar. Captura no escopo do módulo (importado estaticamente
// pelo Feed) e avisa quem já estiver montado.
let promptCapturado: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  promptCapturado = e as BeforeInstallPromptEvent;
  window.dispatchEvent(new Event('pwa-instalavel'));
});

const DISMISS_KEY = '@chain:install-dismissed';

/**
 * Card que recomenda adicionar o app à tela inicial do celular.
 * Android/Chrome: usa o prompt nativo de instalação do PWA.
 * iOS/Safari: não existe API — mostra o passo a passo (Compartilhar → Adicionar à Tela de Início).
 * Some quando o app já está instalado (standalone) ou depois de dispensado.
 */
export const InstallAppCard = () => {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(promptCapturado);
  const [dismissed, setDismissed] = useState<boolean>(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    const onInstalavel = () => setInstallEvent(promptCapturado);
    window.addEventListener('pwa-instalavel', onInstalavel);
    return () => window.removeEventListener('pwa-instalavel', onInstalavel);
  }, []);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (dismissed || isStandalone || (!installEvent && !isIos)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const instalar = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    // O evento só serve uma vez; aceitou ou não, não insistimos nesta visita.
    promptCapturado = null;
    setInstallEvent(null);
    if (outcome === 'accepted') dismiss();
  };

  return (
    <div className="surface rounded-2xl p-4 flex items-start gap-4 text-left relative">
      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
        <Smartphone size={20} />
      </div>

      <div className="flex-1 min-w-0 pr-6">
        <p className="font-sans font-semibold text-sm text-textLight">Adicione o Atchei à tela inicial</p>
        {isIos && !installEvent ? (
          <p className="text-xs text-textMuted mt-0.5 leading-relaxed">
            Toque em <Share size={12} className="inline -mt-0.5 text-primary" aria-label="Compartilhar" /> e
            depois em <span className="font-semibold">"Adicionar à Tela de Início"</span> para abrir como um app.
          </p>
        ) : (
          <>
            <p className="text-xs text-textMuted mt-0.5 leading-relaxed">
              Acesso rápido aos seus eventos e ingressos, como um app.
            </p>
            <button
              onClick={instalar}
              className="mt-2.5 px-4 py-2 rounded-xl bg-primary text-textDark font-sans font-semibold text-xs hover:bg-primaryHover active:scale-95 transition-all duration-200 neo-click cursor-pointer"
            >
              Instalar
            </button>
          </>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dispensar"
        title="Dispensar"
        className="absolute top-3 right-3 p-1.5 rounded-lg text-textMuted hover:text-textLight hover:bg-surfaceHover transition-colors cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
};
