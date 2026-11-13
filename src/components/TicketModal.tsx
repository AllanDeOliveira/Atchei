import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Calendar, Clock, MapPin, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toDataURL } from 'qrcode';
import toast from 'react-hot-toast';
import type { EventItem, Registration } from '../lib/storage';
import { makeTicketCode, ticketCredential } from '../lib/ticketCode';
import { formatCPF } from '../lib/cpf';
import { formatDateExtenso } from '../lib/formatters';
import { Modal } from './ui/Modal';

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem;
  registration: Registration;
}

const formatCpf = (cpf?: string): string => (cpf ? formatCPF(cpf) : '-');

const slugify = (s: string): string =>
  (s || 'ingresso')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (marcas combinantes)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'ingresso';

export const TicketModal = ({ isOpen, onClose, event, registration }: TicketModalProps) => {
  const ticketRef = useRef<HTMLDivElement>(null);
  // Guardado junto com o id de origem: trocar de ingresso "zera" o QR por derivação,
  // sem setState síncrono no effect (regra react-hooks/set-state-in-effect).
  const [qr, setQr] = useState<{ de: string; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const credencial = ticketCredential(registration);
  const shortCode = makeTicketCode(credencial);

  // QR gerado no aparelho (biblioteca `qrcode`): o id da inscrição é a credencial que
  // libera a entrada e não sai para serviço de terceiro; funciona offline e já nasce
  // como data URL, que o html-to-image embute sem CORS na exportação do PNG.
  const qrDataUrl = qr?.de === credencial ? qr.dataUrl : null;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    toDataURL(credencial, { width: 320, margin: 0, color: { dark: '#1c1917', light: '#ffffff' } })
      .then((dataUrl) => { if (active) setQr({ de: credencial, dataUrl }); })
      .catch((e) => console.error('Erro ao gerar o QR do ingresso:', e));
    return () => {
      active = false;
    };
  }, [isOpen, credencial]);

  const handleDownload = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 3, // alta resolução: nítido na galeria e ao imprimir
        cacheBust: true,
        backgroundColor: '#ffffff',
        // Não tenta inlinar as folhas de estilo de fontes externas (Google Fonts). Sem isso,
        // o html-to-image lê `cssRules` de um stylesheet cross-origin e dispara SecurityError
        // no console. A fonte do app (Plus Jakarta Sans) já está carregada na página.
        skipFonts: true,
      });

      const fileName = `ingresso-${slugify(event.title)}-${shortCode}.png`;

      // No celular, tenta compartilhar o arquivo direto (WhatsApp, galeria, etc.).
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      const navAny = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
        share?: (data?: ShareData) => Promise<void>;
      };
      if (navAny.share && navAny.canShare?.({ files: [file] })) {
        try {
          await navAny.share({
            files: [file],
            title: `Ingresso · ${event.title}`,
            text: `Meu ingresso para ${event.title}`,
          });
          return;
        } catch {
          /* usuário cancelou o share → cai no download abaixo */
        }
      }

      // Desktop / sem Web Share: baixa o arquivo.
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } catch (e) {
      console.error('Erro ao gerar a imagem do ingresso:', e);
      toast.error('Não foi possível gerar a imagem do ingresso. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }, [busy, event.title, shortCode]);

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="ticket-modal-title"
      backdropClassName="fixed inset-0 z-[100] modal-backdrop flex items-center justify-center p-4"
      className="relative w-full max-w-md flex flex-col max-h-[92vh]"
    >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-20 p-2 bg-surface border border-glassBorder rounded-full text-textLight hover:bg-surfaceHover active:scale-95 transition-all shadow-glass-shadow cursor-pointer"
          title="Fechar"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        <div className="overflow-y-auto">
          {/* ───────── Cartão do ingresso (capturado na exportação) ───────── */}
          <div
            ref={ticketRef}
            className="printable-ticket relative bg-white rounded-[1.75rem] overflow-hidden shadow-float font-sans"
          >
            {/* Cabeçalho de marca */}
            <div className="relative bg-primary px-6 pt-6 pb-8 text-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              <p id="ticket-modal-title" className="relative text-white/60 text-xs font-bold tracking-[0.4em] uppercase mb-1">
                Ingresso oficial
              </p>
              <p className="relative text-white font-display font-extrabold text-2xl tracking-[0.25em] uppercase">
                Atchei
              </p>
            </div>

            {/* Faixa de status sobre a borda */}
            <div className="relative -mt-4 flex justify-center">
              <span className="inline-flex items-center gap-1.5 bg-success text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-glow-success">
                <CheckCircle2 size={13} />
                {registration.paymentStatus || 'Confirmado'}
              </span>
            </div>

            {/* Corpo */}
            <div className="px-6 pt-5 pb-2 text-center">
              <span className="bg-accent/10 border border-accent/20 text-accent text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 uppercase tracking-wider">
                {registration.ticketTypeName || 'Ingresso comum'}
              </span>
              <h3 className="font-display font-extrabold text-2xl text-textLight leading-tight mb-5">
                {event.title}
              </h3>

              <div className="space-y-3 text-left max-w-[280px] mx-auto">
                <div className="flex items-center gap-3 text-textLight">
                  <Calendar size={16} className="text-accent shrink-0" />
                  <span className="text-sm font-medium">{formatDateExtenso(event.date)}</span>
                </div>
                <div className="flex items-center gap-3 text-textLight">
                  <Clock size={16} className="text-accent shrink-0" />
                  <span className="text-sm font-medium">{event.time}h</span>
                </div>
                <div className="flex items-start gap-3 text-textLight">
                  <MapPin size={16} className="text-accent shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{event.location}</p>
                    {event.address && <p className="text-xs text-textMuted leading-snug mt-0.5">{event.address}</p>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-glassBorder text-left max-w-[280px] mx-auto">
                <div>
                  <span className="text-xs font-semibold text-textMuted uppercase tracking-wider block">Portador</span>
                  <span className="text-sm font-semibold text-textLight truncate block">{registration.userName || '-'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-textMuted uppercase tracking-wider block">CPF</span>
                  <span className="text-sm font-semibold text-textLight tabular-nums truncate block">
                    {formatCpf(registration.userCpf)}
                  </span>
                </div>
              </div>
            </div>

            {/* Perfuração + recortes laterais */}
            <div className="relative flex items-center py-2">
              <div className="absolute -left-3 w-6 h-6 rounded-full bg-background shadow-inner" />
              <div className="flex-1 border-t-2 border-dashed border-glassBorder mx-4" />
              <div className="absolute -right-3 w-6 h-6 rounded-full bg-background shadow-inner" />
            </div>

            {/* Stub do QR */}
            <div className="px-6 pt-2 pb-7 flex flex-col items-center text-center">
              <div className="bg-white p-3 rounded-2xl border border-glassBorder shadow-sm">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code de validação do ingresso"
                    className="w-40 h-40 object-contain"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-textMuted">
                    <Loader2 size={28} className="animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-xs text-textMuted mt-3">Apresente este código na entrada</p>
              <p className="font-mono font-bold tracking-[0.3em] text-textLight text-lg mt-1">{shortCode}</p>
            </div>
          </div>
        </div>

        {/* Ações (fora do cartão, não entram na imagem) — empilham no mobile estreito */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4">
          <button
            onClick={handleDownload}
            disabled={busy || !qrDataUrl}
            className="flex-1 py-3.5 rounded-xl bg-primary text-textDark font-sans font-semibold text-sm hover:bg-primaryHover active:scale-95 transition-all shadow-glow-primary cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {busy ? 'Gerando...' : 'Baixar ingresso'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3.5 rounded-xl border border-glassBorder bg-surface text-textLight font-sans font-semibold text-sm hover:bg-surfaceHover active:scale-95 transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
    </Modal>
  );
};
