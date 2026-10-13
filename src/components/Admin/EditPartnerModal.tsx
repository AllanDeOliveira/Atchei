import { Settings, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { AppProfile } from '../../lib/storage';

type Props = {
  partner: AppProfile;
  setPartner: React.Dispatch<React.SetStateAction<AppProfile | null>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
};

/** Modal de edição de parceiro (nome, tipo, senha, flag de troca obrigatória). */
export const EditPartnerModal = ({ partner, setPartner, onClose, onSubmit, isSaving }: Props) => (
  <Modal
    open
    onClose={onClose}
    labelledBy="admin-edit-partner-title"
    backdropClassName="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
    className="glass rounded-3xl p-6 md:p-8 max-w-md w-full relative max-h-[90vh] overflow-y-auto border border-glassBorder backdrop-blur-3xl text-left shadow-md"
  >
    <button aria-label="Fechar modal" title="Fechar modal" onClick={onClose} className="absolute top-6 right-6 p-2 border border-glassBorder rounded-xl bg-surface/50 hover:bg-surfaceHover hover:border-accent/40 text-textLight cursor-pointer transition-colors duration-200">
      <X size={16} />
    </button>

    <form onSubmit={onSubmit} className="space-y-4 mt-2">
      <div className="text-center mb-6 mt-4">
        <div className="w-14 h-14 bg-primary/20 border border-primary/20 rounded-2xl flex items-center justify-center text-accent mx-auto mb-3">
          <Settings size={24} />
        </div>
        <h3 id="admin-edit-partner-title" className="font-display text-2xl font-semibold text-textLight leading-tight">Editar parceiro</h3>
        <p className="text-xs font-medium text-textMuted mt-1">Modifique as informações e acessos</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-textMuted ml-1">Nome do parceiro</label>
        <Input
          required
          value={partner.name}
          onChange={e => setPartner(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="edit-partner-type" className="text-xs font-medium text-textMuted ml-1">Tipo</label>
        <select
          id="edit-partner-type"
          title="Tipo de parceiro"
          className="w-full h-12 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm text-textLight focus:outline-none focus:border-primary/40 transition-colors duration-200 cursor-pointer"
          value={partner.type}
          onChange={e => setPartner(prev => prev ? ({ ...prev, type: e.target.value as AppProfile['type'] }) : null)}
        >
          <option value="user">Pessoal</option>
          <option value="profissional">Profissional</option>
          <option value="admin">Administrador</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-textMuted ml-1">Nova senha (opcional)</label>
        <Input
          placeholder="Digite para alterar"
          value={partner.password || ''}
          onChange={e => setPartner(prev => prev ? ({ ...prev, password: e.target.value }) : null)}
        />
      </div>

      <div className="flex items-center gap-3.5 mt-4 px-1">
        <input
          type="checkbox"
          id="mustChangePassword"
          checked={partner.mustChangePassword}
          onChange={e => setPartner(prev => prev ? ({ ...prev, mustChangePassword: e.target.checked }) : null)}
          className="accent-primary w-5 h-5 cursor-pointer border border-glassBorder rounded-md"
        />
        <label htmlFor="mustChangePassword" className="text-xs text-textMuted cursor-pointer font-medium">
          Obrigar alteração de senha no login
        </label>
      </div>

      <Button type="submit" loading={isSaving} className="w-full rounded-xl py-4 mt-6">
        {isSaving ? 'Salvando...' : 'Salvar alterações'}
      </Button>
    </form>
  </Modal>
);
