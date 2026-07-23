import { useState, useEffect } from 'react';
import { isValidCPF, isValidEmail } from '../lib/formatters';
import { useRateLimit } from './useRateLimit';

export interface BuyerInfo {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

export type PixStep = 'select_tickets' | 'buyer_info' | 'qr_code' | 'success';

export const PIX_TTL_SECONDS = 600;

export const usePixCheckout = () => {
  const [showPixModal, setShowPixModal] = useState(false);
  const [loadingPix, setLoadingPix] = useState(false);
  const { isLimited: isPixLimited, remainingMs: pixRemainingMs, trigger: triggerPixCooldown } = useRateLimit(10000);
  const [qrCodeData, setQrCodeData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
  const [pedidoId, setPedidoId] = useState('');
  const [pixStep, setPixStep] = useState<PixStep>('buyer_info');
  const [selectedTickets, setSelectedTickets] = useState<{ [key: string]: number }>({});
  
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo>({
    name: '',
    email: '',
    phone: '',
    cpf: '',
  });

  const [pixErrors, setPixErrors] = useState<{ [k: string]: string }>({});
  const [pixCopied, setPixCopied] = useState(false);
  const [expirationTimestamp, setExpirationTimestamp] = useState<number | null>(null);
  const [pixSecondsLeft, setPixSecondsLeft] = useState(PIX_TTL_SECONDS);
  const [pixExpired, setPixExpired] = useState(false);

  const validateBuyer = () => {
    const e: { [k: string]: string } = {};
    if (!buyerInfo.name.trim()) e.name = 'Informe seu nome completo.';
    if (!buyerInfo.email.trim()) e.email = 'Informe seu e-mail.';
    else if (!isValidEmail(buyerInfo.email)) e.email = 'E-mail inválido.';
    if (!buyerInfo.phone.trim()) e.phone = 'Informe seu telefone.';
    else if (buyerInfo.phone.replace(/\D/g, '').length < 10) e.phone = 'Telefone incompleto.';
    if (!buyerInfo.cpf.trim()) e.cpf = 'Informe seu CPF.';
    else if (!isValidCPF(buyerInfo.cpf)) e.cpf = 'CPF inválido.';
    setPixErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearPixError = (field: string) => {
    setPixErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const formatSecondsLeft = (total: number) => {
    const m = Math.floor(Math.max(0, total) / 60).toString().padStart(2, '0');
    const s = (Math.max(0, total) % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Timer de expiração do QR Code Pix baseado em timestamp absoluto
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (showPixModal && pixStep === 'qr_code' && !pixExpired) {
      const updateRemaining = () => {
        if (!expirationTimestamp) {
          setPixSecondsLeft((prev) => {
            if (prev <= 1) {
              setPixExpired(true);
              return 0;
            }
            return prev - 1;
          });
          return;
        }

        const diffSeconds = Math.floor((expirationTimestamp - Date.now()) / 1000);
        if (diffSeconds <= 0) {
          setPixSecondsLeft(0);
          setPixExpired(true);
        } else {
          setPixSecondsLeft(diffSeconds);
        }
      };

      updateRemaining();
      timer = setInterval(updateRemaining, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showPixModal, pixStep, pixExpired, expirationTimestamp]);

  const resetPixCheckout = () => {
    setShowPixModal(false);
    setLoadingPix(false);
    setQrCodeData(null);
    setPedidoId('');
    setPixStep('buyer_info');
    setSelectedTickets({});
    setPixErrors({});
    setPixCopied(false);
    setPixSecondsLeft(PIX_TTL_SECONDS);
    setPixExpired(false);
  };

  return {
    showPixModal,
    setShowPixModal,
    loadingPix,
    setLoadingPix,
    isPixLimited,
    pixRemainingMs,
    triggerPixCooldown,
    qrCodeData,
    setQrCodeData,
    pedidoId,
    setPedidoId,
    pixStep,
    setPixStep,
    selectedTickets,
    setSelectedTickets,
    buyerInfo,
    setBuyerInfo,
    pixErrors,
    setPixErrors,
    pixCopied,
    setPixCopied,
    pixSecondsLeft,
    setPixSecondsLeft,
    pixExpired,
    setPixExpired,
    expirationTimestamp,
    setExpirationTimestamp,
    validateBuyer,
    clearPixError,
    formatSecondsLeft,
    resetPixCheckout,
  };
};
