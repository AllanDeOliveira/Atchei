import { Share, X, HelpCircle } from 'lucide-react';
import { Modal } from './ui/Modal';

/** Passo a passo de instalação do PWA (Chrome/Android e Safari/iOS). */
export const InstallGuideModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Modal
    open={open}
    onClose={onClose}
    labelledBy="install-guide-title"
    backdropClassName="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    className="surface border border-glassBorder rounded-2xl shadow-2xl max-w-sm w-full p-6 text-left relative"
  >
    <div className="flex items-center justify-between pb-3 border-b border-glassBorder">
      <h2 id="install-guide-title" className="text-base font-display font-bold text-textLight flex items-center gap-2">
        <HelpCircle size={18} className="text-accent" /> Como instalar o Atchei
      </h2>
      <button
        onClick={onClose}
        className="text-textMuted hover:text-textLight p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
        aria-label="Fechar guia"
      >
        <X size={18} />
      </button>
    </div>

    <div className="space-y-3.5 my-4 text-xs text-textMuted leading-relaxed">
      <div className="p-3 rounded-xl bg-surface/50 border border-glassBorder">
        <p className="font-semibold text-textLight mb-1">No Google Chrome / Android:</p>
        <p>1. Toque nos <strong>3 pontinhos (⋮)</strong> no canto superior do navegador.</p>
        <p>2. Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
      </div>

      <div className="p-3 rounded-xl bg-surface/50 border border-glassBorder">
        <p className="font-semibold text-textLight mb-1">No Safari / iPhone (iOS):</p>
        <p>1. Toque no botão de <strong>Compartilhar <Share size={12} className="inline text-accent" /></strong>.</p>
        <p>2. Role e toque em <strong>"Adicionar à Tela de Início"</strong>.</p>
        <p>3. Abra o app instalado e ative as notificações no seu perfil. No iPhone, só o app instalado recebe lembretes.</p>
      </div>
    </div>

    <button
      onClick={onClose}
      className="w-full py-2.5 rounded-xl bg-primary text-textDark text-xs font-bold hover:bg-primaryHover transition-all cursor-pointer text-center"
    >
      Entendido
    </button>
  </Modal>
);
