import { useState } from 'react';
import { X, Ticket } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { soldCount } from '../../lib/storage';
import type { EventItem } from '../../lib/storage';
import { formatCPF } from '../../lib/formatters';

export type ManualTicketData = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  ticketTypeId: string;
  paymentStatus: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  event: EventItem;
  /** Executa a criação no backend. Retorna true em sucesso (o modal se limpa e fecha). */
  onGenerate: (data: ManualTicketData) => Promise<boolean>;
};

/** Modal de geração manual de ingressos (cortesia / dinheiro / pix manual).
 *  Dono do próprio estado de formulário — o pai só recebe os dados no submit. */
export const ManualTicketModal = ({ open, onClose, event, onGenerate }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Cortesia');
  const [isGenerating, setIsGenerating] = useState(false);

  const reset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCpf('');
    setTicketTypeId('');
    setPaymentStatus('Cortesia');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const ok = await onGenerate({ name, email, phone, cpf, ticketTypeId, paymentStatus });
      if (ok) {
        reset();
        onClose();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="profile-manual-title"
      backdropClassName="fixed inset-0 z-[110] modal-backdrop flex items-center justify-center p-4"
      className="glass rounded-[2.5rem] p-6 md:p-8 max-w-md w-full relative border border-glassBorder backdrop-blur-3xl shadow-float bg-surface/98 text-left animate-in zoom-in duration-300"
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-surface/50 border border-glassBorder rounded-xl text-textLight hover:bg-surfaceHover hover:border-primary/40 active:scale-95 transition-all duration-300 cursor-pointer neo-click z-10"
        title="Fechar"
        aria-label="Fechar"
      >
        <X size={16} />
      </button>

      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-accent mx-auto mb-3">
          <Ticket size={24} />
        </div>
        <h3 id="profile-manual-title" className="font-display text-xl font-semibold text-textLight">Gerar ingresso manual</h3>
        <p className="text-sm text-textMuted font-sans mt-1">Crie credenciais ou cortesias para o evento</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide">
        <div className="space-y-1.5 text-left">
          <label className="text-xs font-medium text-textMuted ml-1 block">Nome completo</label>
          <input
            type="text"
            required
            placeholder="Nome do participante"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full h-11 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary transition-all duration-300 font-sans"
          />
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-xs font-medium text-textMuted ml-1 block">E-mail (Opcional)</label>
          <input
            type="email"
            placeholder="participante@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full h-11 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary transition-all duration-300 font-sans"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-medium text-textMuted ml-1 block">Telefone (Opcional)</label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full h-11 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary transition-all duration-300 font-sans"
            />
          </div>
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-medium text-textMuted ml-1 block">CPF (Opcional)</label>
            <input
              type="text"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={e => setCpf(formatCPF(e.target.value))}
              className="w-full h-11 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary transition-all duration-300 font-mono"
            />
          </div>
        </div>

        {event.tickets && event.tickets.length > 0 && (
          <div className="space-y-1.5 text-left">
            <label htmlFor="manual-ticket-select" className="text-xs font-medium text-textMuted ml-1 block">Setor / Lote</label>
            <select
              id="manual-ticket-select"
              className="w-full h-11 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-xs font-mono text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary transition-all duration-300"
              value={ticketTypeId}
              onChange={e => setTicketTypeId(e.target.value)}
            >
              <option value="">(Ingresso Geral - Sem Lote)</option>
              {event.tickets.map(t => {
                const available = t.capacity - soldCount(event, t);
                return (
                  <option key={t.id} value={t.id} disabled={available <= 0} className="text-stone-900 bg-white">
                    {t.name} - R$ {t.price.toFixed(2)} ({available} restam)
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="space-y-1.5 text-left">
          <label htmlFor="manual-payment-select" className="text-xs font-medium text-textMuted ml-1 block">Tipo de Ingresso / Pagamento</label>
          <select
            id="manual-payment-select"
            className="w-full h-11 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-xs font-mono text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary transition-all duration-300"
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
          >
            <option value="Cortesia" className="text-stone-900 bg-white">Cortesia / VIP</option>
            <option value="Pago (Dinheiro)" className="text-stone-900 bg-white">Pago (Dinheiro)</option>
            <option value="Pago (Pix Manual)" className="text-stone-900 bg-white">Pago (Pix Manual)</option>
          </select>
        </div>

        <div className="flex gap-3 pt-4 border-t border-glassBorder">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-glassBorder text-textLight font-sans font-semibold text-xs bg-surface/50 hover:bg-surfaceHover transition-all duration-300 active:scale-95 cursor-pointer shadow-glass-shadow"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isGenerating}
            className="flex-1 py-3 rounded-xl bg-primary text-textDark font-sans font-semibold text-xs hover:bg-primaryHover hover:-translate-y-0.5 transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? 'Gerando...' : 'Gerar ingresso'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
