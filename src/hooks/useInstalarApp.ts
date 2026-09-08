import { useEffect, useState } from 'react';

// O evento `beforeinstallprompt` (Chrome/Android) não faz parte dos tipos padrão do DOM
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// Capturado uma vez por sessão, no carregamento: o Chrome dispara antes de qualquer UI
// existir, então guardamos o evento no módulo e avisamos quem estiver montado.
let promptCapturado: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptCapturado = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('pwa-instalavel'));
  });
}

export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true);
export const isIos = (): boolean => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isMobile = (): boolean => isIos() || (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent));

export type ResultadoInstalacao = 'instalado' | 'recusou' | 'guia';

/**
 * Instalação do PWA a partir de qualquer tela.
 * - `disponivel`: celular, ainda não instalado e com caminho de instalação (prompt nativo ou iOS/Safari).
 * - `precisaGuia`: não há prompt nativo (iOS) — o chamador mostra o passo a passo.
 * - `instalar()`: abre o prompt nativo quando existe; devolve 'guia' quando é preciso mostrar o passo a passo.
 */
export function useInstalarApp() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(promptCapturado);

  useEffect(() => {
    const onInstalavel = () => setInstallEvent(promptCapturado);
    window.addEventListener('pwa-instalavel', onInstalavel);
    return () => window.removeEventListener('pwa-instalavel', onInstalavel);
  }, []);

  const disponivel = isMobile() && !isStandalone() && (!!installEvent || isIos());
  const precisaGuia = !installEvent;

  const instalar = async (): Promise<ResultadoInstalacao> => {
    if (!installEvent) return 'guia';
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    promptCapturado = null;
    setInstallEvent(null);
    return outcome === 'accepted' ? 'instalado' : 'recusou';
  };

  return { disponivel, precisaGuia, instalar };
}
