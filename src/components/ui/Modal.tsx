import { useLayoutEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id do título, para aria-labelledby. */
  labelledBy?: string;
  /** id da descrição, para aria-describedby. */
  describedBy?: string;
  /** 'alertdialog' para confirmações que exigem atenção; 'dialog' no resto. */
  role?: 'dialog' | 'alertdialog';
  /** Classes do backdrop — cada diálogo mantém o próprio espaçamento (z-index já não importa). */
  backdropClassName?: string;
  /** Classes do card interno — o visual de cada diálogo continua sendo dele. */
  className?: string;
  /** Fecha ao clicar fora do card. */
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

/**
 * Casca de diálogo sobre o <dialog> nativo com showModal(): foco preso dentro do
 * diálogo, resto da página inerte, Escape e camada superior (acima de qualquer
 * z-index) vêm do navegador. O conteúdo e o visual continuam com quem usa — daí as
 * classes virem por parâmetro. O próprio <dialog> é o backdrop de tela cheia e o
 * card é o filho, como o par de divs que existia antes.
 */
export const Modal = ({ open, ...props }: ModalProps) => (open ? <Aberto {...props} /> : null);

// Neutraliza o estilo padrão do <dialog> (caixa centralizada com borda, fundo branco,
// largura máxima e um ::backdrop cinza) para ele se comportar como o div de antes.
const BASE =
  'fixed inset-0 m-0 p-0 w-auto h-auto max-w-none max-h-none border-0 bg-transparent text-inherit overflow-visible backdrop:bg-transparent';

const Aberto = ({
  onClose,
  labelledBy,
  describedBy,
  role = 'dialog',
  backdropClassName = 'modal-backdrop fixed inset-0 flex items-center justify-center p-4',
  className = '',
  closeOnBackdrop = false,
  children,
}: Omit<ModalProps, 'open'>) => {
  const ref = useRef<HTMLDialogElement>(null);

  // Antes da pintura: fechado, o <dialog> é display:none, mas as classes de layout do
  // backdrop (flex) o mostrariam solto por um quadro. Desmontar o elemento já o tira
  // da camada superior, então a limpeza não precisa de close().
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={cn(BASE, backdropClassName)}
      // Escape: o navegador pede para fechar; quem decide é o estado de quem abriu.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Fechou por conta própria (o navegador pode ignorar o preventDefault acima
      // em Escapes repetidos sem interação): sincroniza o estado.
      onClose={onClose}
      onClick={closeOnBackdrop ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div className={className}>{children}</div>
    </dialog>
  );
};
