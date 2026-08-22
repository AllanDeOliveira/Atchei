import { useEffect, useState } from 'react';
import { INSTALL_DISMISS_KEY } from '../lib/storageKeys';

// Disparado pelo InstallAppCard quando o usuário resolve o convite de instalação —
// instalando ou clicando "Agora não". É o gatilho para o aviso de cookies aparecer.
export const INSTALL_RESOLVED_EVENT = 'atchei:install-resolved';

/** O convite de instalação ainda vai ocupar a tela? */
export const isInstallCardPending = (): boolean => {
  if (typeof window === 'undefined') return false;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  if (isStandalone) return false;

  try {
    return localStorage.getItem(INSTALL_DISMISS_KEY) !== '1';
  } catch {
    // Sem localStorage não dá para saber se já foi dispensado, e o card se
    // comporta como não dispensado — o aviso de cookies espera do mesmo jeito.
    return true;
  }
};

/**
 * Os dois pop-ups ocupam exatamente a mesma posição na tela. Em vez de empilhar um
 * sobre o outro, o aviso de cookies espera o convite de instalação sair de cena;
 * este hook diz se ainda é a vez do convite.
 */
export const useInstallCardPending = (): boolean => {
  const [pending, setPending] = useState(isInstallCardPending);

  useEffect(() => {
    const atualizar = () => setPending(isInstallCardPending());
    window.addEventListener(INSTALL_RESOLVED_EVENT, atualizar);
    return () => window.removeEventListener(INSTALL_RESOLVED_EVENT, atualizar);
  }, []);

  return pending;
};
