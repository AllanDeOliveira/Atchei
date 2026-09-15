import { useEffect, useState } from 'react';
import { Share, Download } from 'lucide-react';
import { INSTALL_DISMISS_KEY as DISMISS_KEY } from '../lib/storageKeys';
import { INSTALL_RESOLVED_EVENT } from '../hooks/useInstallCardPending';
import { COOKIE_CONSENT_KEY } from '../lib/firebase';
import { useInstalarApp } from '../hooks/useInstalarApp';
import { InstallGuideModal } from './InstallGuideModal';

/**
 * Pop-up flutuante para adicionar o app à tela inicial (PWA), com o mesmo design do aviso de cookies.
 * Só no mobile e em navegadores com caminho de instalação (prompt nativo ou iOS/Safari).
 * Entra em cena 2s depois da decisão de cookies, para os dois pop-ups não empilharem.
 * A mecânica de instalação em si vive em useInstalarApp (reaproveitada em outras telas).
 */
export const InstallAppCard = () => {
  const { disponivel, precisaGuia, instalar } = useInstalarApp();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(DISMISS_KEY) === '1' : false;
    } catch {
      return false;
    }
  });
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [liberado, setLiberado] = useState(false);

  // Espera a decisão de cookies (desta visita ou de uma anterior) + 2s antes de aparecer.
  useEffect(() => {
    let timer: number | undefined;
    const liberar = () => { timer = window.setTimeout(() => setLiberado(true), 2000); };
    let jaDecidiu = false;
    try {
      jaDecidiu = typeof localStorage !== 'undefined' && localStorage.getItem(COOKIE_CONSENT_KEY) !== null;
    } catch {
      // localStorage indisponível — trata como não decidido
    }
    if (jaDecidiu) liberar();
    else window.addEventListener('atchei:cookies-decididos', liberar);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('atchei:cookies-decididos', liberar);
    };
  }, []);

  // Só mobile, só com caminho de instalação, nunca antes da vez dele na fila de pop-ups.
  if (!liberado || dismissed || !disponivel) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // localStorage indisponível
    }
    setDismissed(true);
    setShowGuideModal(false);
    // Libera a vez para o aviso de cookies, que ocupa a mesma posição na tela.
    window.dispatchEvent(new Event(INSTALL_RESOLVED_EVENT));
  };

  const onInstalar = async () => {
    // Sem prompt nativo (iOS): abre o passo a passo na hora, sem esperar promessa.
    if (precisaGuia) {
      setShowGuideModal(true);
      return;
    }
    if ((await instalar()) === 'instalado') dismiss();
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
          {precisaGuia ? (
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
            onClick={onInstalar}
            className="flex-1 bg-primary text-textDark font-sans font-bold text-xs md:text-sm py-2.5 px-4 rounded-xl hover:bg-primaryHover active:scale-95 transition-all cursor-pointer text-center shadow-md shadow-primary/20 flex items-center justify-center gap-1.5"
          >
            <Download size={15} />
            {precisaGuia ? 'Como instalar' : 'Instalar app'}
          </button>
          <button
            onClick={dismiss}
            className="flex-1 bg-surface border border-glassBorder text-textLight font-sans font-semibold text-xs md:text-sm py-2.5 px-4 rounded-xl hover:bg-surfaceHover active:scale-95 transition-all cursor-pointer text-center"
          >
            Agora não
          </button>
        </div>
      </aside>

      <InstallGuideModal open={showGuideModal} onClose={() => setShowGuideModal(false)} />
    </>
  );
};
