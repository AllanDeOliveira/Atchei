import { Download, Plus, X, Users, User, ScanLine } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { STATUS_AGUARDANDO } from '../../lib/storage';
import type { EventItem, Registration } from '../../lib/storage';
import { maskCPF, maskPhone } from '../../lib/formatters';

type Props = {
  open: boolean;
  onClose: () => void;
  event: EventItem;
  participants: Registration[];
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onExportCSV: () => void;
  onOpenManual: () => void;
  onConfirmarPagamento: (reg: Registration) => void;
  onRemoverDaLista: (reg: Registration) => void;
  onValidate: () => void;
};

/** Modal de lista de inscritos de um evento: paginação, exportação CSV, geração
 *  manual, confirmação/remoção de intenções WhatsApp e atalho para a portaria. */
export const ParticipantsModal = ({
  open, onClose, event, participants, isLoading, hasMore, isLoadingMore,
  onLoadMore, onExportCSV, onOpenManual, onConfirmarPagamento, onRemoverDaLista, onValidate,
}: Props) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="profile-participants-title"
      closeOnBackdrop
      backdropClassName="fixed inset-0 z-[100] modal-backdrop flex items-center justify-center p-6"
      className="glass rounded-[2rem] p-5 md:p-8 max-w-lg md:max-w-2xl w-full relative flex flex-col max-h-[85vh] border border-glassBorder backdrop-blur-3xl shadow-float bg-surface/98"
    >
      <div className="absolute top-5 right-5 md:top-6 md:right-6 flex items-center gap-1.5 md:gap-2">
        <button
          onClick={onExportCSV}
          disabled={participants.length === 0 || isLoading}
          className="p-2 md:p-2.5 bg-surface/50 border border-glassBorder text-accent rounded-xl hover:bg-surfaceHover hover:border-accent/40 active:scale-95 transition-all duration-300 neo-click cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exportar CSV"
          aria-label="Exportar lista de participantes em CSV"
        >
          <Download className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
        </button>
        <button
          onClick={onOpenManual}
          className="p-2 md:p-2.5 bg-surface/50 border border-glassBorder text-primary rounded-xl hover:bg-surfaceHover hover:border-primary/40 active:scale-95 transition-all duration-300 neo-click cursor-pointer"
          title="Gerar Ingresso Manual"
          aria-label="Gerar ingresso manual"
        >
          <Plus className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
        </button>
        <button
          title="Fechar"
          aria-label="Fechar"
          onClick={onClose}
          className="p-2 md:p-2.5 bg-surface/50 border border-glassBorder rounded-xl text-textLight hover:bg-surfaceHover hover:border-primary/40 active:scale-95 transition-all duration-300 neo-click cursor-pointer"
        >
          <X className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
        </button>
      </div>

      <div className="text-center mb-4 md:mb-6">
        <div className="w-11 h-11 md:w-16 md:h-16 bg-primary/20 border border-primary/20 rounded-xl md:rounded-2xl flex items-center justify-center text-primary mx-auto mb-2 md:mb-3">
          <Users className="w-5 h-5 md:w-7 md:h-7" />
        </div>
        <h3 id="profile-participants-title" className="font-display text-base md:text-xl font-semibold text-accent truncate px-10 md:px-16">{event.title}</h3>
        <p className="text-xs text-textMuted mt-0.5 font-sans">Lista de presenças confirmadas</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide space-y-3.5 min-h-[160px] max-h-[50vh] md:max-h-[58vh] text-left">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16 text-primary gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-sans text-xs text-textMuted">Carregando lista…</span>
          </div>
        ) : participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center text-textMuted">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-primary/5 border border-glassBorder rounded-2xl flex items-center justify-center mb-3">
              <User className="w-5 h-5 md:w-6 md:h-6 text-primary/30" />
            </div>
            <p className="font-sans text-sm md:text-base font-semibold text-textLight">Nenhum participante ainda</p>
            <p className="font-sans text-[10px] md:text-xs text-textMuted mt-1">As confirmações aparecerão aqui</p>
          </div>
        ) : (
          <div className="space-y-2.5 md:space-y-3">
            <div className="flex justify-between items-center px-1 mb-1 md:mb-2">
              <span className="text-[9px] md:text-[10px] font-sans font-medium text-accent">Participante</span>
              <span className="font-sans text-xs text-textLight bg-surface px-2 md:px-3 py-0.5 md:py-1 border border-glassBorder rounded-lg font-medium">{participants.length} confirmado(s)</span>
            </div>
            {participants.map((reg) => {
              const isPaid = reg.paymentStatus === 'Pago' || reg.paymentStatus?.includes('Pago');
              const hasOverbooking = reg.paymentStatus?.includes('Overbooking');
              const isPending = reg.paymentStatus === STATUS_AGUARDANDO;

              return (
                <div key={reg.id} className="p-4 md:p-5 bg-white/80 border border-glassBorder/40 rounded-2xl space-y-2.5 md:space-y-3.5 text-left shadow-glass-shadow hover:bg-white/95 transition-colors duration-300">
                  <div className="flex items-center justify-between gap-2.5 md:gap-3">
                    <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-primary/20 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs md:text-sm shrink-0 shadow-sm">
                        {reg.userName ? reg.userName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-sans font-bold text-xs md:text-base text-textLight truncate leading-tight">{reg.userName || 'Usuário Anônimo'}</p>
                        <p className="font-mono text-[10px] md:text-xs text-textMuted truncate mt-0.5 md:mt-1 leading-none">{reg.userEmail || 'Sem e-mail'}</p>
                      </div>
                    </div>
                    <span className={`px-2 md:px-3 py-0.5 md:py-1 border rounded-lg text-[11px] font-sans font-semibold shrink-0 ${
                      hasOverbooking
                        ? 'bg-danger/10 text-danger border-danger/20'
                        : isPending
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : isPaid
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-surface/50 text-textLight border-glassBorder'
                    }`}>
                      {reg.paymentStatus || 'Gratuito'}
                    </span>
                  </div>

                  {reg.ticketTypeName && (
                    <div className="px-2 md:px-3 py-1 bg-accent/5 border border-accent/10 rounded-lg md:rounded-xl inline-block">
                      <span className="text-[8px] md:text-[9px] font-sans font-medium text-accent">Setor/Lote: {reg.ticketTypeName}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 md:gap-4 pt-2 md:pt-3 text-[10px] md:text-xs font-mono text-textLight">
                    <div>
                      <span className="text-[8px] md:text-[9px] font-bold text-primary/70 uppercase block mb-0.5 tracking-wider">Telefone</span>
                      <span className="text-[10px] md:text-sm font-semibold">{reg.userPhone ? maskPhone(reg.userPhone) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[8px] md:text-[9px] font-bold text-primary/70 uppercase block mb-0.5 tracking-wider">CPF</span>
                      <span className="text-[10px] md:text-sm font-semibold">{reg.userCpf ? maskCPF(reg.userCpf) : '-'}</span>
                    </div>
                  </div>
                  <div className="text-[11px] font-sans text-textMuted/70 text-right pt-1.5">
                    {isPending ? 'Entrou na lista em' : 'Confirmado em'}: {new Date(reg.timestamp).toLocaleDateString('pt-BR')} {new Date(reg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  {/* Intenção via WhatsApp: o vendedor decide — confirma o pagamento ou remove */}
                  {isPending && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => onConfirmarPagamento(reg)}
                        className="flex-1 py-2.5 rounded-xl bg-success/10 border border-success/30 text-success font-sans font-semibold text-xs hover:bg-success/20 active:scale-95 transition-all cursor-pointer"
                      >
                        Pagamento confirmado
                      </button>
                      <button
                        onClick={() => onRemoverDaLista(reg)}
                        className="flex-1 py-2.5 rounded-xl bg-surface border border-glassBorder text-textMuted font-sans font-semibold text-xs hover:text-danger hover:border-danger/30 active:scale-95 transition-all cursor-pointer"
                      >
                        Remover da lista
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Botão Carregar Mais para Paginação de Inscrições */}
            {hasMore && (
              <button
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="w-full py-3.5 rounded-xl border border-glassBorder text-textLight hover:text-accent hover:border-accent/40 font-sans text-xs font-medium bg-surface hover:bg-surfaceHover active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer neo-click"
              >
                {isLoadingMore ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Carregar mais participantes'
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 md:pt-4 border-t border-glassBorder mt-3 md:mt-4 flex gap-3">
        <button
          onClick={onValidate}
          className="flex-1 flex items-center justify-center gap-2 py-3 md:py-4 rounded-xl bg-primary text-textDark font-sans font-semibold text-sm hover:bg-primaryHover active:scale-95 transition-all duration-200 neo-click cursor-pointer"
        >
          <ScanLine size={16} /> Validar ingressos
        </button>
        <button
          onClick={onClose}
          className="px-5 py-3 md:py-4 rounded-xl bg-surface border border-glassBorder text-textLight font-sans font-medium text-sm hover:bg-surfaceHover active:scale-95 transition-all duration-200 neo-click cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
};
