import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id do título, para aria-labelledby. */
  labelledBy?: string;
  /** id da descrição, para aria-describedby. */
  describedBy?: string;
  /** 'alertdialog' para confirmações que exigem atenção; 'dialog' no resto. */
  role?: 'dialog' | 'alertdialog';
  /** Classes do backdrop — cada diálogo mantém o próprio z-index/espaçamento. */
  backdropClassName?: string;
  /** Classes do card interno — o visual de cada diálogo continua sendo dele. */
  className?: string;
  /** Fecha ao clicar fora do card (o clique dentro não propaga). */
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

/**
 * Casca de diálogo: backdrop, Escape para fechar e a semântica de acessibilidade
 * (role/aria-modal), que antes era reescrita em cada modal. O conteúdo e o visual
 * continuam com quem usa — daí as classes virem por parâmetro.
 */
export const Modal = ({
  open,
  onClose,
  labelledBy,
  describedBy,
  role = 'dialog',
  backdropClassName = 'modal-backdrop fixed inset-0 z-[99999] flex items-center justify-center p-4',
  className = '',
  closeOnBackdrop = false,
  children,
}: ModalProps) => {
  useEscapeToClose(open, onClose);
  if (!open) return null;

  return (
    <div
      className={backdropClassName}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div className={className} onClick={closeOnBackdrop ? (e) => e.stopPropagation() : undefined}>
        {children}
      </div>
    </div>
  );
};
