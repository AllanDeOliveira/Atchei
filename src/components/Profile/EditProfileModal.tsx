import { X, Edit2, User, Camera } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { InstagramIcon } from '../InstagramIcon';

export type EditProfileData = {
  name: string;
  description: string;
  instagram: string;
  imageUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  editData: EditProfileData;
  setEditData: React.Dispatch<React.SetStateAction<EditProfileData>>;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  isUploadingPhoto: boolean;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

/** Modal de edição do perfil público (foto, nome, descrição, redes). */
export const EditProfileModal = ({ open, onClose, editData, setEditData, onSubmit, isSaving, isUploadingPhoto, onPhotoChange }: Props) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="profile-edit-title"
      closeOnBackdrop
      backdropClassName="fixed inset-0 z-[100] modal-backdrop flex items-center justify-center p-4"
      className="glass rounded-[2.5rem] p-6 max-w-md w-full relative flex flex-col max-h-[90vh] backdrop-blur-3xl border border-glassBorder"
    >
      <button
        title="Fechar"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-surface/50 border border-glassBorder rounded-xl text-textLight hover:bg-surfaceHover transition-all duration-300 cursor-pointer z-10 neo-click"
      >
        <X size={16} />
      </button>

      <div className="text-center mb-5">
        <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-accent mx-auto mb-2.5">
          <Edit2 size={20} />
        </div>
        <h3 id="profile-edit-title" className="font-display text-xl font-semibold text-accent">Editar perfil</h3>
        <p className="text-xs text-textMuted mt-1">Atualize as informações públicas da sua marca</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1 scrollbar-hide py-2 text-left">
        {/* Foto de Perfil Upload */}
        <div className="flex flex-col items-center gap-2 pb-4 border-b border-glassBorder">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-surface/40 border border-dashed border-glassBorder overflow-hidden flex items-center justify-center relative shadow-inner">
              {editData.imageUrl ? (
                <img src={editData.imageUrl} className="w-full h-full object-cover" alt="Prévia" />
              ) : (
                <User size={30} className="text-textMuted" />
              )}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-background/65 flex items-center justify-center text-accent">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {editData.imageUrl && (
              <button
                type="button"
                onClick={() => setEditData({ ...editData, imageUrl: '' })}
                className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-danger border border-danger/20 text-textDark flex items-center justify-center shadow-md hover:bg-danger/90 hover:scale-105 active:scale-95 transition-all cursor-pointer z-10"
                title="Remover foto"
              >
                <X size={10} strokeWidth={3} />
              </button>
            )}
            <label htmlFor="profile-photo-upload" className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-accent border border-glassBorder text-textDark flex items-center justify-center shadow-md hover:scale-105 transition-all cursor-pointer hover:border-accent/40 duration-300">
              <Camera size={13} />
              <input id="profile-photo-upload" title="Mudar Foto" aria-label="Mudar Foto" type="file" className="hidden" accept="image/*" disabled={isUploadingPhoto} onChange={onPhotoChange} />
            </label>
          </div>
          <span className="text-xs font-sans font-medium text-accent">Clique no ícone para alterar</span>
        </div>

        {/* Informações Gerais */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-textMuted ml-1 block">Nome do Perfil</label>
            <input
              type="text"
              required
              placeholder="Seu nome ou o da sua marca"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              className="w-full h-12 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm font-sans text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary placeholder:text-textMuted/50 transition-all duration-300"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-textMuted ml-1 block">Descrição / Sobre</label>
            <textarea
              placeholder="Escreva um breve texto sobre você ou seu negócio..."
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              className="w-full min-h-[90px] bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 py-3 text-sm font-sans text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary resize-none placeholder:text-textMuted/50 transition-all duration-300"
            />
          </div>
        </div>

        {/* Redes Sociais */}
        <div className="space-y-4 pt-3 border-t border-glassBorder">
          <h4 className="text-xs font-medium text-textMuted ml-1">Redes sociais</h4>

          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center bg-surfaceHover/50 border border-glassBorder rounded-xl px-3 focus-within:border-primary/40 focus-within:shadow-glow-primary transition-all duration-300">
              <InstagramIcon size={14} className="text-accent mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Instagram (Ex: @seu.perfil)"
                value={editData.instagram}
                onChange={(e) => setEditData({ ...editData, instagram: e.target.value })}
                className="w-full h-11 bg-transparent border-0 px-1 text-sm font-sans text-textLight focus:outline-none placeholder:text-textMuted/50"
              />
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 pt-4 border-t border-glassBorder mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl border border-glassBorder text-textLight font-sans font-semibold text-xs bg-surface/50 hover:bg-surfaceHover transition-all duration-300 active:scale-95 cursor-pointer shadow-glass-shadow"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving || isUploadingPhoto}
            className="flex-1 py-3.5 rounded-xl bg-primary text-textDark font-sans font-semibold text-xs hover:bg-primaryHover hover:-translate-y-0.5 transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
