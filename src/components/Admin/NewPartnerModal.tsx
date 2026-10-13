import { useState } from 'react';
import { X, UserPlus, Upload, ShieldCheck, Mail, Lock, Copy, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { AppProfile } from '../../lib/storage';

export type NewPartnerForm = {
  name: string;
  type: AppProfile['type'];
  description: string;
  imageUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  form: NewPartnerForm;
  setForm: React.Dispatch<React.SetStateAction<NewPartnerForm>>;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  isUploading: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Credenciais geradas — quando presente, mostra a tela de sucesso no lugar do form. */
  lastGenerated: { email: string; pass: string } | null;
};

/** Modal de cadastro de parceiro: formulário e, após criar, a tela com as credenciais. */
export const NewPartnerModal = ({ open, onClose, form, setForm, onSubmit, isSaving, isUploading, onImageUpload, lastGenerated }: Props) => {
  const [copied, setCopied] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="admin-new-partner-title"
      backdropClassName="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
      className="glass rounded-3xl p-6 md:p-8 max-w-md w-full relative border border-glassBorder backdrop-blur-3xl text-left shadow-md"
    >
      <button aria-label="Fechar modal" title="Fechar modal" onClick={onClose} className="absolute top-6 right-6 p-2 border border-glassBorder rounded-xl bg-surface/50 hover:bg-surfaceHover hover:border-accent/40 text-textLight cursor-pointer transition-colors duration-200">
        <X size={16} />
      </button>

      {!lastGenerated ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="text-center mb-6 mt-4">
            <div className="w-14 h-14 bg-primary/20 border border-primary/20 rounded-2xl flex items-center justify-center text-accent mx-auto mb-3">
              <UserPlus size={24} />
            </div>
            <h3 id="admin-new-partner-title" className="font-display text-2xl font-semibold text-textLight leading-tight">Cadastrar parceiro</h3>
            <p className="text-xs font-medium text-textMuted mt-1">Crie acesso para novos parceiros</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-textMuted ml-1">Nome do parceiro</label>
            <Input
              required
              placeholder="Ex: Velvet Club"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="partner-type" className="text-xs font-medium text-textMuted ml-1">Tipo</label>
            <select
              id="partner-type"
              className="w-full h-12 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm text-textLight focus:outline-none focus:border-primary/40 transition-colors duration-200 cursor-pointer"
              value={form.type}
              onChange={e => setForm(prev => ({ ...prev, type: e.target.value as AppProfile['type'] }))}
            >
              <option value="user">Pessoal</option>
              <option value="profissional">Profissional</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-textMuted ml-1">Descrição curta</label>
            <Input
              required
              placeholder="Ex: O melhor lounge da cidade"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-medium text-textMuted ml-1 block">Foto do parceiro (opcional)</label>
            <div className="flex items-center gap-3.5 bg-surface/30 p-3 rounded-xl border border-glassBorder">
              {form.imageUrl ? (
                <div className="relative w-14 h-14 rounded-lg border border-glassBorder overflow-hidden shrink-0 group">
                  <img src={form.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                    className="absolute inset-0 bg-danger/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-textDark transition-opacity duration-200 text-xs font-semibold cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <label className="w-14 h-14 rounded-lg border border-dashed border-primary/45 flex flex-col items-center justify-center text-textMuted cursor-pointer hover:border-accent hover:text-accent transition-colors duration-200 bg-surface/50 hover:bg-surfaceHover">
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={16} className="text-accent" />
                      <span className="text-xs font-medium mt-1">Upload</span>
                    </>
                  )}
                  <input type="file" className="hidden" accept="image/*" disabled={isUploading} onChange={onImageUpload} />
                </label>
              )}
              <div className="text-xs text-textMuted leading-relaxed">
                {form.imageUrl ? "Foto pronta para salvar!" : "Selecione uma imagem JPG/PNG de até 5MB."}
              </div>
            </div>
          </div>

          <Button type="submit" loading={isSaving} className="w-full rounded-xl py-4 mt-6">
            {isSaving ? 'Salvando...' : 'Gerar acesso e salvar'}
          </Button>
        </form>
      ) : (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-success/10 text-success rounded-2xl border border-success/20 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck size={32} />
          </div>
          <h3 id="admin-new-partner-title" className="font-display text-2xl font-semibold text-textLight leading-tight mb-2">Parceiro criado!</h3>
          <p className="text-sm text-textMuted mb-6">Salve os dados de acesso abaixo:</p>

          <div className="surface p-5 rounded-2xl mb-8 relative shadow-sm space-y-4 text-left">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${lastGenerated.email}\nSenha: ${lastGenerated.pass}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="absolute top-4 right-4 p-2 bg-surface/50 hover:bg-surfaceHover text-accent border border-glassBorder hover:border-primary/40 rounded-xl cursor-pointer transition-colors duration-200"
              title="Copiar dados"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>

            <div>
              <p className="text-xs font-medium text-textMuted mb-1">E-mail de acesso</p>
              <p className="font-mono text-sm font-bold text-textLight flex items-center gap-2">
                <Mail size={14} className="text-accent" />
                {lastGenerated.email}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-textMuted mb-1">Senha temporária</p>
              <p className="font-mono text-sm font-bold text-textLight flex items-center gap-2">
                <Lock size={14} className="text-accent" />
                {lastGenerated.pass}
              </p>
            </div>
          </div>

          <Button onClick={onClose} className="w-full rounded-xl py-3.5">
            Concluído
          </Button>
        </div>
      )}
    </Modal>
  );
};
