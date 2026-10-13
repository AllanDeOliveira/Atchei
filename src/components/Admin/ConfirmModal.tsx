import { Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { cn } from '../../lib/utils';

export type ConfirmModalState = {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'danger' | 'warning';
};

type Props = {
  state: ConfirmModalState;
  onClose: () => void;
};

/** Diálogo de confirmação genérico do painel admin (excluir evento/parceiro). */
export const ConfirmModal = ({ state, onClose }: Props) => (
  <Modal
    open={state.show}
    onClose={onClose}
    role="alertdialog"
    labelledBy="admin-confirm-title"
    describedBy="admin-confirm-desc"
    closeOnBackdrop
    backdropClassName="fixed inset-0 z-[100] modal-backdrop flex items-center justify-center p-6"
    className="glass rounded-3xl p-6 md:p-8 max-w-sm w-full border border-glassBorder backdrop-blur-3xl text-center shadow-md"
  >
    <div className="flex flex-col items-center">
      <div className={cn(
        "w-16 h-16 rounded-2xl border flex items-center justify-center mb-6",
        state.type === 'danger' ? "bg-danger/10 border-danger/20 text-danger" : "bg-primary/10 border-primary/20 text-accent"
      )}>
        <Trash2 size={26} />
      </div>
      <h3 id="admin-confirm-title" className="font-display text-xl font-semibold text-textLight mb-3">{state.title}</h3>
      <p id="admin-confirm-desc" className="text-sm text-textMuted mb-8 font-sans leading-relaxed">
        {state.message}
      </p>
      <div className="flex gap-3.5 w-full">
        <button
          onClick={onClose}
          className="flex-1 py-3.5 rounded-xl border border-glassBorder bg-surface/50 text-textLight font-sans font-semibold text-sm hover:bg-surfaceHover hover:border-accent/40 hover:text-accent transition-colors duration-200 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={state.onConfirm}
          className={cn(
            "flex-1 py-3.5 rounded-xl border font-sans font-semibold text-sm transition-colors duration-200 cursor-pointer shadow-sm text-textDark",
            state.type === 'danger'
              ? "bg-danger border-danger/20 hover:brightness-95"
              : "bg-primary border-primary/20 hover:bg-primaryHover"
          )}
        >
          Confirmar
        </button>
      </div>
    </div>
  </Modal>
);
