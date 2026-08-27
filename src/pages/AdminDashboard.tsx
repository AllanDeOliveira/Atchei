import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../lib/storage';
import { formatDateBR } from '../lib/formatters';
import type { EventItem, Registration } from '../lib/storage';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { EditPartnerModal } from '../components/Admin/EditPartnerModal';
import { NewPartnerModal } from '../components/Admin/NewPartnerModal';
import { ConfirmModal } from '../components/Admin/ConfirmModal';
import { Calendar, Users, Settings, Trash2, Search as SearchIcon, Building2, Mail } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';
import type { AppProfile } from '../lib/storage';
import { httpsCallable } from 'firebase/functions';
import { getFunctionsInstance } from '../lib/firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseConfig } from '../lib/firebase';
import toast from 'react-hot-toast';


// Gera senha temporária forte usando CSPRNG (não Math.random, que é previsível).
const generateSecurePassword = (length = 14): string => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += charset[values[i] % charset.length];
  }
  return pass;
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'partners'>('events');
  const [query, setQuery] = useState('');

  // Partner Form State
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: '',
    type: 'profissional' as AppProfile['type'],
    description: '',
    imageUrl: ''
  });
  const [lastGenerated, setLastGenerated] = useState<{ email: string; pass: string } | null>(null);
  const [editingPartner, setEditingPartner] = useState<AppProfile | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handlePartnerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A imagem é muito grande (máx 5MB).");
        return;
      }
      setIsUploading(true);
      try {
        const url = await storage.uploadFile(file, 'profiles');
        setNewPartner(prev => ({ ...prev, imageUrl: url }));
      } catch (err) {
        console.error(err);
        toast.error("Erro ao fazer upload da imagem.");
      } finally {
        setIsUploading(false);
      }
    }
  };
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning'
  });

  // Basic auth check for MVP
  const currentUser = storage.getCurrentUser();
  const userId = currentUser?.id;
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPartner, setIsSavingPartner] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId || currentUser?.role !== 'admin') {
      navigate('/feed');
      return;
    }

    try {
      const [allEvents, allRegs, allProfiles] = await Promise.all([
        storage.getEvents(),
        storage.getRegistrations(),
        storage.getProfiles()
      ]);

      setEvents(allEvents);
      setRegistrations(allRegs);
      setProfiles(allProfiles);
    } catch (error) {
      console.error("Erro ao carregar dados do admin:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, navigate, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir evento?',
      message: 'Esta ação removerá o evento permanentemente e cancelará todas as inscrições.',
      type: 'danger',
      onConfirm: async () => {
        await storage.deleteEvent(id);
        const updatedEvents = await storage.getEvents();
        setEvents(updatedEvents);
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDeleteProfile = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir parceiro?',
      message: 'Todos os acessos e dados deste parceiro serão removidos do sistema.',
      type: 'danger',
      onConfirm: async () => {
        await storage.deleteProfile(id);
        setProfiles(prev => prev.filter(p => p.id !== id));
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    // Remove acentos e espaços do nome para gerar e-mail válido no Firebase Auth.
    // O domínio é o do Hosting do projeto de propósito: subdomínio do Firebase que
    // ninguém de fora consegue registrar, então não dá para sequestrar o endereço e
    // pedir redefinição por ele. Como não recebe e-mail, a redefinição destas contas
    // é sempre pelo painel (adminResetPassword), nunca por link.
    const email = `${newPartner.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '')}@atchei.web.app`;
    const password = generateSecurePassword();

    setIsSavingPartner(true);
    try {
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;

      await signOut(secondaryAuth); // Finaliza a sessão temporária

      // 2. Salvar o perfil no Firestore usando o UID real
      const profile: AppProfile = {
        id: uid,
        ...newPartner,
        email,
        mustChangePassword: true
      };

      await storage.saveProfile(profile);
      const allProfiles = await storage.getProfiles();
      setProfiles(allProfiles);
      setLastGenerated({ email, pass: password }); // A senha fica só na tela, nunca no banco

      setNewPartner({ name: '', type: 'profissional', description: '', imageUrl: '' });
    } catch (error) {
      console.error("Erro ao adicionar parceiro:", error);
      if ((error as { code?: string })?.code === 'auth/email-already-in-use') {
        toast.error("Este parceiro já existe! Tente adicionar um número ou sobrenome ao nome.");
      } else {
        toast.error("Erro ao criar parceiro. Verifique o console.");
      }
    } finally {
      setIsSavingPartner(false);
    }
  };

  const handleEditPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    setIsSavingPartner(true);
    try {
      const updates: Partial<AppProfile> = {
        name: editingPartner.name,
        type: editingPartner.type,
        description: editingPartner.description || '',
        mustChangePassword: editingPartner.mustChangePassword || false
      };

      // Se uma nova senha foi digitada, redefinir usando a Cloud Function segura
      if (editingPartner.password && editingPartner.password.trim() !== '') {
        const functions = getFunctionsInstance();
        const adminResetPassword = httpsCallable(functions, 'adminResetPassword');
        await adminResetPassword({
          uid: editingPartner.id,
          newPassword: editingPartner.password
        });

        // Forçar alteração de senha no próximo login
        updates.mustChangePassword = true;
      }

      await storage.updateProfile(editingPartner.id, updates);
      const allProfiles = await storage.getProfiles();
      setProfiles(allProfiles);
      setEditingPartner(null);
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error("Erro ao atualizar parceiro:", error);
      toast.error("Erro ao atualizar parceiro ou ao redefinir a senha.");
    } finally {
      setIsSavingPartner(false);
    }
  };

  const filteredEvents = events.filter(e => e.title.toLowerCase().includes(query.toLowerCase()));
  const filteredProfiles = profiles.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  const totalRegistrations = registrations.length;

  return (
    <>
      <div ref={containerRef} className="min-h-screen bg-background pb-28 pt-8 px-4 relative">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6 admin-anim relative z-10 text-left">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center border border-accent/20">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="font-display font-semibold text-2xl text-textLight leading-tight">Painel de controle</h1>
            <p className="text-xs font-medium text-textMuted mt-0.5">Gerencie seus eventos e parceiros</p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 gap-3.5 mb-6 admin-anim relative z-10 text-left">
          <div className="surface p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Calendar size={15} />
              <span className="text-xs font-medium text-textMuted">Total de eventos</span>
            </div>
            <span className="font-display text-3xl font-semibold text-textLight leading-none">{events.length}</span>
          </div>
          <div className="surface p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-accent mb-2">
              <Users size={15} />
              <span className="text-xs font-medium text-textMuted">Inscrições</span>
            </div>
            <span className="font-display text-3xl font-semibold text-textLight leading-none">{totalRegistrations}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6 admin-anim relative z-10">
          <button
            onClick={() => setActiveTab('events')}
            className={cn(
              "flex-1 py-3.5 rounded-xl font-sans font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2 border cursor-pointer",
              activeTab === 'events'
                ? "bg-primary/10 text-primary border-primary/30"
                : "surface text-textMuted hover:text-textLight"
            )}
          >
            <Calendar size={16} />
            Eventos
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={cn(
              "flex-1 py-3.5 rounded-xl font-sans font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2 border cursor-pointer",
              activeTab === 'partners'
                ? "bg-accent/10 text-accent border-accent/30"
                : "surface text-textMuted hover:text-textLight"
            )}
          >
            <Building2 size={16} />
            Parceiros
          </button>
        </div>

        <div className="relative mb-4 admin-anim z-10">
          <Input
            placeholder={activeTab === 'events' ? "Buscar eventos..." : "Buscar parceiros..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 md:pl-12"
          />
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
        </div>

        {activeTab === 'events' ? (
          <>
            <div className="flex justify-between items-center mb-4 admin-anim relative z-10 flex-wrap gap-2">
              <h2 className="font-display text-lg font-semibold text-textLight">Gerenciar eventos</h2>
              <div className="flex gap-2">
                <Button onClick={() => navigate('/create')} variant="primary" size="sm" className="rounded-xl">
                  + Novo evento
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={`ev-sk-${i}`} className="h-32 rounded-2xl" />
              ))}
              {filteredEvents.map(event => {
                const eventRegs = registrations.filter(r => r.eventId === event.id).length;

                return (
                  <div key={event.id} className="surface surface-hover p-5 rounded-2xl flex flex-col gap-3.5 admin-anim shadow-sm text-left">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold text-base text-textLight truncate">{event.title}</h3>
                        <p className="text-xs text-textMuted mt-1.5">{formatDateBR(event.date)}</p>
                      </div>
                      <div className="bg-primary/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0 border border-primary/20">
                        <Users size={12} className="text-primary" />
                        <span className="font-mono text-xs font-bold text-primary">{eventRegs}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-glassBorder">
                      <button
                        onClick={() => navigate(`/event/${event.id}`)}
                        className="flex-1 py-2 rounded-xl text-sm font-sans font-semibold text-textLight surface hover:text-accent transition-colors duration-200 cursor-pointer"
                      >
                        Ver página
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="px-4 py-2 text-textMuted hover:text-danger border border-glassBorder hover:border-danger/40 rounded-xl bg-surface/50 hover:bg-danger/10 transition-colors duration-200 cursor-pointer"
                        title="Excluir evento"
                        aria-label="Excluir evento"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!isLoading && filteredEvents.length === 0 && (
                <div className="text-center py-10 admin-anim">
                  <p className="text-textMuted text-sm">Nenhum evento encontrado.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 admin-anim relative z-10">
              <h2 className="font-display text-lg font-semibold text-textLight">Gerenciar parceiros</h2>
              <Button onClick={() => { setLastGenerated(null); setShowPartnerModal(true); }} variant="primary" size="sm" className="rounded-xl">
                + Novo parceiro
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={`pt-sk-${i}`} className="h-24 rounded-2xl" />
              ))}
              {filteredProfiles.map(profile => (
                <div key={profile.id} className="surface surface-hover p-4 rounded-2xl flex items-center gap-4 admin-anim shadow-sm text-left">
                  <div className="w-12 h-12 rounded-xl bg-surface/50 flex items-center justify-center text-accent overflow-hidden shrink-0 border border-glassBorder shadow-sm">
                    {profile.imageUrl ? <img src={profile.imageUrl} alt={`Foto de ${profile.name}`} className="w-full h-full object-cover" /> : <Building2 size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-base font-semibold text-textLight truncate leading-tight">{profile.name}</h3>
                    <p className="text-xs text-accent font-medium mt-1">{profile.type}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-primary font-mono bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
                      <Mail size={10} />
                      {profile.email || 'N/A'}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditingPartner(profile)}
                        className="p-1.5 text-textLight hover:text-accent transition-colors duration-200 bg-surface/50 hover:bg-surfaceHover rounded-xl border border-glassBorder hover:border-accent/40 cursor-pointer"
                        title="Editar parceiro"
                      >
                        <Settings size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="p-1.5 text-textLight hover:text-danger transition-colors duration-200 bg-surface/50 hover:bg-surfaceHover rounded-xl border border-glassBorder hover:border-danger/40 cursor-pointer"
                        title="Excluir parceiro"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!isLoading && filteredProfiles.length === 0 && (
                <div className="text-center py-10 admin-anim">
                  <p className="text-textMuted text-sm">Nenhum parceiro encontrado.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Editar Parceiro */}
        {editingPartner && (
          <EditPartnerModal
            partner={editingPartner}
            setPartner={setEditingPartner}
            onClose={() => setEditingPartner(null)}
            onSubmit={handleEditPartner}
            isSaving={isSavingPartner}
          />
        )}

        {/* Modal Novo Parceiro */}
        <NewPartnerModal
          open={showPartnerModal}
          onClose={() => setShowPartnerModal(false)}
          form={newPartner}
          setForm={setNewPartner}
          onSubmit={handleAddPartner}
          isSaving={isSavingPartner}
          isUploading={isUploading}
          onImageUpload={handlePartnerImageUpload}
          lastGenerated={lastGenerated}
        />
      </div>

      {/* Custom Confirm Modal */}
      <ConfirmModal
        state={confirmModal}
        onClose={() => setConfirmModal(prev => ({ ...prev, show: false }))}
      />
    </>
  );
};
