import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, sendEmailVerification } from 'firebase/auth';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { storage, soldCount, STATUS_AGUARDANDO, STATUS_PAGO_WHATSAPP } from '../lib/storage';
import type { EventItem, Registration } from '../lib/storage';
import { User, LogOut, Calendar, MapPin, Clock, Trash2, Navigation, Ticket, Camera, Users, Edit2, Mail } from 'lucide-react';
import { InstagramIcon } from '../components/InstagramIcon';
import { TicketModal } from '../components/TicketModal';
import { Modal } from '../components/ui/Modal';
import { NotificationToggle } from '../components/NotificationToggle';
import { Skeleton } from '../components/ui/Skeleton';
import { EditProfileModal } from '../components/Profile/EditProfileModal';
import { ParticipantsModal } from '../components/Profile/ParticipantsModal';
import { ManualTicketModal } from '../components/Profile/ManualTicketModal';
import type { ManualTicketData } from '../components/Profile/ManualTicketModal';
import { useAuth } from '../contexts/AuthContext';
import { compressImage, dataURLtoBlob } from '../lib/imageUtils';
import toast from 'react-hot-toast';

import { formatCPF, formatPhone, mapsDirUrl, waMeUrl } from '../lib/formatters';

export const Profile = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { user, updateUser } = useAuth();
  const userRole = user?.role;

  // Aviso de e-mail não verificado (typo no cadastro inviabiliza recuperar ingresso).
  const [emailNaoVerificado, setEmailNaoVerificado] = useState(false);
  const [verificacaoReenviada, setVerificacaoReenviada] = useState(false);
  useEffect(() => {
    // onAuthStateChanged em vez de auth.currentUser direto: cobre a hidratação pós-F5.
    const unsub = onAuthStateChanged(auth, (u) => setEmailNaoVerificado(!!u && !u.emailVerified));
    return unsub;
  }, []);
  const reenviarVerificacao = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setVerificacaoReenviada(true);
      toast.success('E-mail de verificação enviado! Confira sua caixa de entrada.');
    } catch {
      toast.error('Não foi possível enviar agora. Tente novamente em alguns minutos.');
    }
  };

  // Estados do Perfil e Imagem
  const [imageUrl, setImageUrl] = useState<string>(user?.imageUrl || '');
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'public' | 'test' | 'participados'>('public');
  // Abas do usuário comum: eventos criados por ele vs. eventos em que se inscreveu.
  const [userTab, setUserTab] = useState<'meus' | 'inscricoes'>('meus');

  // Estados do Ticket
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [selectedRegForTicket, setSelectedRegForTicket] = useState<Registration | null>(null);
  const [selectedEventForTicket, setSelectedEventForTicket] = useState<EventItem | null>(null);
  const [showTicketModal, setShowTicketModal] = useState<boolean>(false);

  // Modal de geração manual de ingressos (o formulário vive dentro do próprio modal).
  const [showManualTicketModal, setShowManualTicketModal] = useState<boolean>(false);

  const [editData, setEditData] = useState({
    name: user?.name || '',
    description: '',
    instagram: '',
    imageUrl: user?.imageUrl || ''
  });



  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingPhoto(true);
      try {
        if (file.size > 10 * 1024 * 1024) { // 10MB
          toast.error("A imagem é muito grande. Escolha uma foto de até 10MB.");
          return;
        }
        const compressed = await compressImage(file, 400, 400, 0.7);
        if (compressed) {
          const blob = dataURLtoBlob(compressed);
          const compressedFile = new File([blob], `profile_${user?.id || 'partner'}.jpg`, { type: 'image/jpeg' });
          const url = await storage.uploadFile(compressedFile, 'profiles');
          setEditData(prev => ({ ...prev, imageUrl: url }));
        }
      } catch (error) {
        console.error("Erro ao fazer upload da foto de perfil:", error);
        toast.error("Erro ao enviar imagem de perfil.");
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  // Estados para Modal de Participantes
  const [showParticipantsModal, setShowParticipantsModal] = useState<boolean>(false);
  const [selectedEventForParticipants, setSelectedEventForParticipants] = useState<EventItem | null>(null);
  const [participantsList, setParticipantsList] = useState<Registration[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState<boolean>(false);
  const [participantsLastDoc, setParticipantsLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreParticipants, setHasMoreParticipants] = useState<boolean>(true);
  const [isLoadingMoreParticipants, setIsLoadingMoreParticipants] = useState<boolean>(false);

  const loadEvents = useCallback(async () => {
    try {
      const all = await storage.getEvents();
      const currentUser = storage.getCurrentUser();
      const currentUserId = currentUser?.id;
      const currentUserRole = currentUser?.role;
      const currentProfileId = currentUser?.profileId;

      const visibleEvents = currentUserRole === 'admin' ? all : all.filter(e => !e.isTestEvent);

      if (currentUserRole === 'admin') {
        setMyEvents(visibleEvents);
        // Admin também cria e participa: carrega as próprias inscrições para a aba "Participados".
        if (currentUserId) {
          const myRegs = await storage.getRegistrationsForUser(currentUserId);
          setMyRegistrations(myRegs);
        }
      } else if (currentUserId) {
        // Qualquer usuário pode criar eventos: a lista junta os criados por ele
        // e os com presença confirmada (o card decide as ações por dono).
        const targetId = currentProfileId || currentUserId;
        const myRegs = await storage.getRegistrationsForUser(currentUserId);
        setMyRegistrations(myRegs);
        const myRegIds = myRegs.map(r => r.eventId);
        setMyEvents(visibleEvents.filter(e => e.creatorId === targetId || myRegIds.includes(e.id)));
      }
    } catch (error) {
      console.error("Erro ao carregar eventos do perfil:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  }, []);

  // Sincronizar dados em tempo real do Firestore
  useEffect(() => {
    const syncProfile = async () => {
      if (user && userRole !== 'admin' && user.username) {
        try {
          const remoteProfile = await storage.getProfileByEmail(user.username);
          if (remoteProfile) {
            setImageUrl(remoteProfile.imageUrl || '');
            setEditData({
              name: remoteProfile.name || '',
              description: remoteProfile.description || '',
              instagram: remoteProfile.instagram || '',
              imageUrl: remoteProfile.imageUrl || ''
            });
            
            // Sincronizar contexto
            if (remoteProfile.imageUrl !== user.imageUrl || remoteProfile.name !== user.name || !user.profileId) {
              const updatedUser = {
                ...user,
                name: remoteProfile.name,
                imageUrl: remoteProfile.imageUrl || '',
                profileId: remoteProfile.id
              };
              updateUser(updatedUser);
              loadEvents();
            }
          }
        } catch (error) {
          console.error("Erro ao sincronizar perfil:", error);
        }
      }
    };
    syncProfile();
  }, [userRole, loadEvents]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleDelete = async (id: string) => {
    await storage.deleteEvent(id);
    setMyEvents(prev => prev.filter(e => e.id !== id));
    setDeleteConfirm(null);
  };

  const handleLogout = async () => {
    await storage.logout();
    navigate('/');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.username) return;
    setIsSaving(true);
    try {
      const updated = await storage.updatePartnerProfile(user.username, {
        name: editData.name,
        description: editData.description,
        instagram: editData.instagram,
        imageUrl: editData.imageUrl
      });
      if (updated) {
        setImageUrl(editData.imageUrl);
        setImgFailed(false);
        setShowEditModal(false);
        
        // Atualiza contexto caso mudou a foto/nome base
        if (user) {
          updateUser({
            ...user,
            name: editData.name,
            imageUrl: editData.imageUrl
          });
        }
        
        loadEvents();
      }
    } catch (error) {
      console.error("Erro ao salvar informações do perfil:", error);
      toast.error("Erro ao salvar informações do perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenParticipants = async (event: EventItem) => {
    setSelectedEventForParticipants(event);
    setShowParticipantsModal(true);
    setIsLoadingParticipants(true);
    setParticipantsList([]);
    setParticipantsLastDoc(null);
    setHasMoreParticipants(true);
    try {
      const { registrations: list, lastDoc } = await storage.getPaginatedRegistrationsForEvent(event.id, null, 10);
      // Ordena por data decrescente (já ordenado pelo Firestore no webhook, mas garantimos aqui)
      const sorted = list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setParticipantsList(sorted);
      setParticipantsLastDoc(lastDoc);
      if (list.length < 10) {
        setHasMoreParticipants(false);
      }
    } catch (error) {
      console.error("Erro ao buscar participantes:", error);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const handleLoadMoreParticipants = async () => {
    if (!selectedEventForParticipants || isLoadingMoreParticipants || !hasMoreParticipants) return;
    setIsLoadingMoreParticipants(true);
    try {
      const { registrations: list, lastDoc } = await storage.getPaginatedRegistrationsForEvent(
        selectedEventForParticipants.id,
        participantsLastDoc,
        10
      );
      const sorted = list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setParticipantsList(prev => [...prev, ...sorted]);
      setParticipantsLastDoc(lastDoc);
      if (list.length < 10) {
        setHasMoreParticipants(false);
      }
    } catch (error) {
      console.error("Erro ao buscar mais participantes:", error);
    } finally {
      setIsLoadingMoreParticipants(false);
    }
  };

  // Cria a inscrição manual no backend. Retorna true em sucesso — o ManualTicketModal
  // é dono do formulário e se limpa/fecha sozinho a partir desse retorno.
  const handleGenerateManualTicket = async (data: ManualTicketData): Promise<boolean> => {
    if (!selectedEventForParticipants) return false;
    if (!data.name) {
      toast.error("Preencha o nome do participante.");
      return false;
    }

    // Encontrar nome do lote/tipo do ticket selecionado
    let ticketTypeName = 'Geral';
    if (data.ticketTypeId && selectedEventForParticipants.tickets) {
      const selectedTicket = selectedEventForParticipants.tickets.find(t => t.id === data.ticketTypeId);
      if (selectedTicket) {
        ticketTypeName = selectedTicket.name;
      }
    }

    const cleanCpf = data.cpf.replace(/\D/g, '');
    const cleanPhone = data.phone.replace(/\D/g, '');

    const newRegistration: Registration = {
      id: `man_${Date.now()}`,
      eventId: selectedEventForParticipants.id,
      userId: `guest-manual-${Date.now()}`,
      userName: data.name,
      userEmail: data.email || '',
      userPhone: cleanPhone || '',
      userCpf: cleanCpf || '',
      paymentStatus: data.paymentStatus, // Cortesia / Pago (Dinheiro) / Pago (Pix Manual)
      timestamp: new Date().toISOString(),
      ticketTypeId: data.ticketTypeId || '',
      ticketTypeName: ticketTypeName
    };

    // O teto (maxParticipants) não bloqueia o organizador — furar o próprio limite
    // (cortesia, convidado extra) é decisão dele; só avisa.
    const ev = selectedEventForParticipants;
    if (ev.maxParticipants != null && (ev.registrationCount || 0) >= ev.maxParticipants) {
      toast(`Atenção: o evento já atingiu o limite de ${ev.maxParticipants} participantes.`, { icon: '⚠️' });
    }

    try {
      // Salvar no banco
      const realDocId = await storage.saveRegistration(newRegistration);

      // Atualizar o ID real retornado
      const regWithRealId = { ...newRegistration, id: realDocId };

      // O contador de vendidos do lote (soldByTicket) é incrementado pelo backend
      // (trigger onRegistrationCreated) — as rules bloqueiam essa escrita pelo cliente.
      // Reflete localmente só para a UI não esperar o trigger.
      if (data.ticketTypeId) {
        setSelectedEventForParticipants(prev => prev ? {
          ...prev,
          soldByTicket: {
            ...prev.soldByTicket,
            [data.ticketTypeId]: soldCount(prev, { id: data.ticketTypeId }) + 1,
          },
        } : prev);
      }

      // Adicionar à lista local de participantes exibida na tela
      setParticipantsList(prev => [regWithRealId, ...prev]);

      toast.success("Ingresso manual gerado com sucesso!");
      return true;
    } catch (error) {
      console.error("Erro ao gerar ingresso manual:", error);
      toast.error("Erro ao gerar ingresso manual.");
      return false;
    }
  };

  // Vendedor confirma o pagamento combinado no WhatsApp — a intenção vira ingresso.
  const handleConfirmarPagamento = async (reg: Registration) => {
    try {
      await storage.confirmRegistrationPayment(reg.id);
      setParticipantsList(prev => prev.map(r => r.id === reg.id ? { ...r, paymentStatus: STATUS_PAGO_WHATSAPP } : r));
      toast.success('Pagamento confirmado! O ingresso já está no perfil do comprador.');
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error);
      toast.error('Não foi possível confirmar o pagamento.');
    }
  };

  // Comprador desistiu (ou nunca pagou): sai da lista sem virar ingresso.
  const handleRemoverDaLista = async (reg: Registration) => {
    try {
      await storage.deleteRegistration(reg.id);
      setParticipantsList(prev => prev.filter(r => r.id !== reg.id));
      toast('Removido da lista.');
    } catch (error) {
      console.error('Erro ao remover da lista:', error);
      toast.error('Não foi possível remover.');
    }
  };

  const exportToCSV = async () => {
    if (!selectedEventForParticipants) return;
    setIsLoadingParticipants(true);
    try {
      // Para o CSV, buscamos a lista completa para garantir a exportação correta de todos os participantes
      const fullList = await storage.getRegistrationsForEvent(selectedEventForParticipants.id);
      if (fullList.length === 0) {
        toast.error("Nenhum participante confirmado para exportar.");
        return;
      }
      const sorted = fullList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const headers = ['Nome;E-mail;Telefone;CPF;Situação de Pagamento;Data da Inscrição'];
      const rows = sorted.map(p => {
        const name = p.userName || '';
        const email = p.userEmail || '';
        const phone = p.userPhone || '';
        const cpf = p.userCpf || '';
        const status = p.paymentStatus || 'Gratuito';
        const date = new Date(p.timestamp).toLocaleString('pt-BR');
        
        // Formata os campos e envolve com ="..." para forçar o Excel a tratá-los como texto de forma segura
        const formattedPhone = phone ? `="${formatPhone(phone)}"` : '""';
        const formattedCpf = cpf ? `="${formatCPF(cpf)}"` : '""';
        
        return `${name};${email};${formattedPhone};${formattedCpf};${status};${date}`;
      });
      const csvContent = '\uFEFF' + headers.concat(rows).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `participantes_${selectedEventForParticipants?.title.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast.error("Ocorreu um erro ao exportar a lista.");
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const openMaps = (event: EventItem) => {
    window.open(mapsDirUrl(event.location, event.address), '_blank');
  };

  // "Aberto" até o fim do dia da data do evento; "Encerrado" a partir do dia seguinte (mesmo critério da Agenda).
  const eventoAberto = (event: EventItem) =>
    new Date(`${event.date}T00:00`) >= new Date(new Date().setHours(0, 0, 0, 0));

  const openWhatsApp = (event: EventItem) => {
    const contact = (event.whatsappContacts || [])[0];
    if (!contact) return;
    const message = `Olá${contact.name ? ` ${contact.name}` : ''}! Gostaria de comprar ingresso para o evento *${event.title}* (${event.time} - ${event.location}).`;
    window.open(waMeUrl(contact.phone, message), '_blank');
  };

  const isOwner = (event: EventItem) => event.creatorId === (user?.profileId || user?.id);

  const filteredEvents = myEvents.filter(event => {
    if (userRole === 'admin') {
      // Participados: eventos em que o admin se inscreveu e NÃO é o criador.
      if (activeTab === 'participados') return !isOwner(event) && myRegistrations.some(r => r.eventId === event.id);
      if (activeTab === 'public') return !event.isTestEvent;
      return !!event.isTestEvent;
    }
    // Evento criado que também tem inscrição própria fica em "Meus eventos" —
    // as ações de dono (inscritos/editar/excluir) prevalecem no card.
    return userTab === 'meus' ? isOwner(event) : !isOwner(event);
  });

  return (
    <div ref={containerRef} className="min-h-screen bg-background pb-28 relative">
      {/* Header */}
      <div className="px-5 pt-8 pb-4 relative z-10 md:hidden">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img 
              src={`${import.meta.env.BASE_URL}placeholder-logo.png`}
              alt="Atchei"
              className="w-auto h-14 object-contain brightness-110 drop-shadow-sm"
            />
          </div>
          {user && (
            <button
              onClick={handleLogout}
              className="w-12 h-12 bg-surface border border-glassBorder text-primary rounded-xl flex items-center justify-center shadow-sm hover:border-danger/40 hover:text-danger hover:-translate-y-0.5 transition-all duration-200 neo-click cursor-pointer"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Aviso de e-mail não verificado */}
      {user && emailNaoVerificado && (
        <div className="profile-el mx-5 mb-4 relative z-10 surface rounded-2xl p-4 border border-primary/30 flex items-start gap-3 text-left">
          <Mail size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-textLight">Confirme seu e-mail</p>
            <p className="text-xs text-textMuted mt-0.5 leading-snug">
              Enviamos um link de verificação para <span className="font-semibold">{user.username}</span>.
              Sem ele, você pode perder o acesso aos seus ingressos se digitar o e-mail errado.
            </p>
            {!verificacaoReenviada && (
              <button
                onClick={reenviarVerificacao}
                className="mt-2 text-xs font-semibold text-primary underline underline-offset-2 cursor-pointer"
              >
                Reenviar e-mail de verificação
              </button>
            )}
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="profile-el mx-5 mb-6 relative z-10">
        {user ? (
          <div className="surface rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center gap-5 relative z-10">
              {/* Foto do Perfil com Botão de Alteração */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-surface/40 flex items-center justify-center border border-glassBorder overflow-hidden relative shadow-md">
                  {imageUrl && !imgFailed ? (
                    <img 
                      src={imageUrl} 
                      className="w-full h-full object-cover" 
                      alt={user?.name} 
                      onError={() => setImgFailed(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-background/10 to-background/30 flex items-center justify-center text-textMuted font-sans font-bold text-2xl italic">
                      {user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : <User size={36} />}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-surface/85 border border-glassBorder text-accent flex items-center justify-center shadow-md hover:bg-surfaceHover hover:scale-110 hover:border-accent/40 active:scale-95 transition-all duration-300 cursor-pointer"
                  title="Alterar Foto de Perfil"
                >
                  <Camera size={12} />
                </button>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <h2 className="font-display font-semibold text-2xl text-textLight">{user.name}</h2>
                <p className="flex items-center gap-1.5 font-mono text-xs text-textMuted mt-0.5 truncate">
                  <Mail size={12} className="text-primary shrink-0" />
                  {user.username}
                </p>
                {editData.description && (
                  <p className="text-xs font-sans text-textLight font-medium mt-2 max-w-[200px] line-clamp-2 leading-relaxed">{editData.description}</p>
                )}
                
                {/* Instagram: ícone + @handle, no mesmo padrão da linha do e-mail */}
                {editData.instagram && (
                  <a
                    href={`https://instagram.com/${editData.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-mono text-xs text-textMuted mt-2.5 truncate hover:text-textLight transition-colors"
                    title="Instagram"
                  >
                    <InstagramIcon size={12} className="text-primary shrink-0" />
                    @{editData.instagram.replace('@', '')}
                  </a>
                )}

                <div className="flex items-center gap-2 mt-2.5">
                  <Calendar size={13} className="text-accent" />
                  <span className="text-xs text-textMuted font-medium">
                    {`${myEvents.length} evento${myEvents.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
                
                <button
                  onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-1.5 mt-3.5 px-3 py-1.5 bg-surface border border-glassBorder hover:border-accent/40 rounded-lg font-sans text-xs font-medium text-textLight hover:text-accent transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 neo-click"
                >
                  <Edit2 size={12} />
                  Editar perfil
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="surface rounded-2xl p-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-6">
              <User className="text-primary" size={36} />
            </div>
            <h2 className="font-display font-semibold text-xl text-accent mb-2">Área do parceiro</h2>
            <p className="font-sans text-sm text-textMuted mb-6 max-w-xs leading-relaxed">
              Faça login para gerenciar seus eventos, ver participantes e destacar suas festas.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full max-w-[200px] py-3.5 rounded-xl bg-primary text-textDark font-sans font-semibold text-sm hover:bg-primaryHover hover:-translate-y-0.5 active:scale-95 transition-all duration-200 neo-click cursor-pointer"
            >
              Fazer login
            </button>
          </div>
        )}
      </div>

      {/* Toggle de notificações push (só aparece se houver suporte e chave VAPID) */}
      {user && (
        <div className="profile-el mx-5 mb-6 relative z-10">
          <NotificationToggle />
        </div>
      )}

      {/* Events Section - only for logged in users */}
      {user && (
        <div className="relative z-10">
          {userRole === 'admin' ? (
            <div className="profile-el px-5 mb-6 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-glassBorder/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 bg-primary/40 rounded-full" />
                  <h2 className="font-display font-semibold text-xl text-textLight">
                    Painel de eventos
                  </h2>
                </div>
                
                <div className="flex bg-surface/40 p-1 rounded-xl border border-glassBorder self-start sm:self-auto">
                  <button
                    onClick={() => setActiveTab('public')}
                    className={`px-4 py-2 rounded-lg font-sans text-xs font-medium transition-all duration-200 cursor-pointer ${
                      activeTab === 'public'
                        ? 'bg-primary text-textDark font-semibold'
                        : 'text-textMuted hover:text-textLight'
                    }`}
                  >
                    Meus eventos ({myEvents.filter(e => !e.isTestEvent).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('test')}
                    className={`px-4 py-2 rounded-lg font-sans text-xs font-medium transition-all duration-200 cursor-pointer ${
                      activeTab === 'test'
                        ? 'bg-accent text-textDark font-semibold'
                        : 'text-textMuted hover:text-textLight'
                    }`}
                  >
                    Testes ({myEvents.filter(e => !!e.isTestEvent).length})
                  </button>
                  <button
                    onClick={() => setActiveTab('participados')}
                    className={`px-4 py-2 rounded-lg font-sans text-xs font-medium transition-all duration-200 cursor-pointer ${
                      activeTab === 'participados'
                        ? 'bg-primary text-textDark font-semibold'
                        : 'text-textMuted hover:text-textLight'
                    }`}
                  >
                    Inscrições ({myEvents.filter(e => !isOwner(e) && myRegistrations.some(r => r.eventId === e.id)).length})
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="profile-el px-5 mb-6 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-glassBorder/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-5 bg-primary/40 rounded-full" />
                  <h2 className="font-display font-semibold text-xl text-textLight">
                    Eventos
                  </h2>
                </div>

                <div className="flex bg-surface/40 p-1 rounded-xl border border-glassBorder self-start sm:self-auto">
                  <button
                    onClick={() => setUserTab('meus')}
                    className={`px-4 py-2 rounded-lg font-sans text-xs font-medium transition-all duration-200 cursor-pointer ${
                      userTab === 'meus'
                        ? 'bg-primary text-textDark font-semibold'
                        : 'text-textMuted hover:text-textLight'
                    }`}
                  >
                    Meus eventos ({myEvents.filter(isOwner).length})
                  </button>
                  <button
                    onClick={() => setUserTab('inscricoes')}
                    className={`px-4 py-2 rounded-lg font-sans text-xs font-medium transition-all duration-200 cursor-pointer ${
                      userTab === 'inscricoes'
                        ? 'bg-primary text-textDark font-semibold'
                        : 'text-textMuted hover:text-textLight'
                    }`}
                  >
                    Minhas inscrições ({myEvents.filter(e => !isOwner(e)).length})
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-5">
            {isLoadingEvents && Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={`pe-sk-${i}`} className="h-44 rounded-2xl" />
            ))}
            {filteredEvents.map((event) => (
              <div key={event.id} className="profile-el surface surface-hover rounded-2xl overflow-hidden text-left">
                <div 
                  className="p-5 cursor-pointer hover:bg-surfaceHover/15 transition-colors group/card"
                  onClick={() => navigate(`/event/${event.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {event.isTestEvent ? (
                          <span className="bg-accent/10 border border-accent/25 text-accent text-[11px] px-2.5 py-0.5 rounded-full font-medium">
                            Evento de teste (Admin)
                          </span>
                        ) : eventoAberto(event) ? (
                          <span className="text-[#2E8B57] text-[11px] font-medium">
                            Aberto
                          </span>
                        ) : (
                          <span className="text-textMuted text-[11px] font-medium">
                            Encerrado
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-semibold text-lg text-textLight leading-tight">{event.title}</h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-textMuted">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-primary" />
                      <span className="font-mono text-xs font-bold text-primary">{event.time}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); openMaps(event); }} className="flex items-center gap-1.5 text-accent hover:text-accentHover transition-colors cursor-pointer">
                      <MapPin size={13} className="text-accent" />
                      <span className="font-mono text-xs hover:underline">{event.location}</span>
                    </button>
                  </div>

                  {event.address && (
                    <button onClick={(e) => { e.stopPropagation(); openMaps(event); }} className="mt-1.5 flex items-center gap-1 text-textMuted hover:text-textLight transition-colors cursor-pointer">
                      <MapPin size={11} className="shrink-0" />
                      <span className="text-[11px] truncate">{event.address}</span>
                    </button>
                  )}

                  <p className="font-sans text-sm text-textMuted mt-3.5 line-clamp-2 leading-relaxed">
                    {event.description}
                  </p>
                </div>

                <div className="flex border-t border-glassBorder bg-surface/30">
                  {/* Na aba "Participados" o admin é participante, não dono: mostra ações de participante. */}
                  {(user?.role === 'admin' && activeTab !== 'participados') || isOwner(event) ? (
                    <>
                      <button
                        onClick={() => handleOpenParticipants(event)}
                        className="flex-1 flex flex-col items-center justify-center gap-1 py-3.5 text-accent font-sans font-medium text-[11px] hover:bg-surface/50 transition-colors cursor-pointer"
                      >
                        <Users size={14} />
                        Inscritos
                      </button>
                      <div className="w-[1px] bg-glassBorder" />
                      <button
                        onClick={() => navigate(`/edit/${event.id}`)}
                        className="flex-1 flex flex-col items-center justify-center gap-1 py-3.5 text-textLight font-sans font-medium text-[11px] hover:bg-surface/50 transition-colors cursor-pointer"
                      >
                        <Edit2 size={14} />
                        Editar
                      </button>
                      <div className="w-[1px] bg-glassBorder" />
                      <button
                        onClick={() => setDeleteConfirm(event.id)}
                        className="flex-1 flex flex-col items-center justify-center gap-1 py-3.5 text-danger font-sans font-medium text-[11px] hover:bg-danger/10 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                        Excluir
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          const reg = myRegistrations.find(r => r.eventId === event.id);
                          if (reg?.paymentStatus === STATUS_AGUARDANDO) {
                            // Intenção via WhatsApp ainda sem confirmação — não há QR pra mostrar.
                            toast('Aguardando o vendedor confirmar o pagamento. Seu ingresso aparece aqui assim que ele confirmar.');
                          } else if (reg?.paymentStatus === 'Gratuito') {
                            // Presença é RSVP social, não ingresso — não existe QR para mostrar.
                            toast('Presença confirmada! Este evento não emite ingresso — é só chegar. 🎉');
                          } else if (reg) {
                            setSelectedRegForTicket(reg);
                            setSelectedEventForTicket(event);
                            setShowTicketModal(true);
                          } else {
                            openWhatsApp(event);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 text-success font-sans font-semibold text-xs hover:bg-success/10 transition-colors cursor-pointer"
                      >
                        <Ticket size={14} />
                        Ver ingresso
                      </button>
                      <div className="w-[1px] bg-glassBorder" />
                      <button
                        onClick={() => openMaps(event)}
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 text-primary font-sans font-semibold text-xs hover:bg-primary/10 transition-colors cursor-pointer"
                      >
                        <Navigation size={14} />
                        Como chegar
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!isLoadingEvents && filteredEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4 col-span-full">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Calendar size={24} className="text-primary/40" />
                </div>
                <p className="font-sans text-textMuted text-sm mb-4">
                  {userRole === 'admin'
                    ? (activeTab === 'public' ? 'Nenhum evento público cadastrado.'
                        : activeTab === 'test' ? 'Nenhum evento de teste cadastrado.'
                        : 'Você ainda não participou de eventos.')
                    : (userTab === 'meus'
                        ? 'Você ainda não criou eventos.'
                        : 'Você ainda não garantiu ingresso nem confirmou presença em eventos.')
                  }
                </p>
                {userRole !== 'admin' && (
                  <button
                    onClick={() => navigate(userTab === 'meus' ? '/create' : '/')}
                    className="px-6 py-2.5 bg-surface hover:bg-primary text-primary hover:text-textDark border border-glassBorder rounded-full font-sans text-sm font-medium transition-all active:scale-95 cursor-pointer"
                  >
                    {userTab === 'meus' ? 'Criar evento' : 'Explorar eventos'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
      <Modal
        open
        onClose={() => setDeleteConfirm(null)}
        role="alertdialog"
        labelledBy="profile-delete-title"
        closeOnBackdrop
        backdropClassName="fixed inset-0 z-[100] modal-backdrop flex items-center justify-center p-6"
        className="glass rounded-[2rem] p-6 max-w-sm w-full relative overflow-hidden backdrop-blur-2xl border border-glassBorder"
      >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger border border-danger/20 flex items-center justify-center mb-4 shadow-md">
                <Trash2 size={22} />
              </div>
              <h3 id="profile-delete-title" className="font-display text-xl font-semibold text-accent mb-2">Excluir evento?</h3>
              <p className="font-sans text-sm text-textMuted mb-6 leading-relaxed">
                Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3.5 rounded-xl border border-glassBorder text-textLight bg-surface hover:bg-surfaceHover font-sans font-semibold text-xs shadow-sm hover:-translate-y-0.5 active:scale-95 transition-all duration-200 neo-click cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-3.5 rounded-xl bg-danger text-textDark border border-danger/20 font-sans font-semibold text-xs shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-300 neo-click cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </div>
      </Modal>
      )}

      {/* Modal Editar Perfil Completo */}
      <EditProfileModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        editData={editData}
        setEditData={setEditData}
        onSubmit={handleSaveProfile}
        isSaving={isSaving}
        isUploadingPhoto={isUploadingPhoto}
        onPhotoChange={handleProfilePhotoChange}
      />

      {/* Modal de Participantes Inscritos */}
      {selectedEventForParticipants && (
        <ParticipantsModal
          open={showParticipantsModal}
          onClose={() => setShowParticipantsModal(false)}
          event={selectedEventForParticipants}
          participants={participantsList}
          isLoading={isLoadingParticipants}
          hasMore={hasMoreParticipants}
          isLoadingMore={isLoadingMoreParticipants}
          onLoadMore={handleLoadMoreParticipants}
          onExportCSV={exportToCSV}
          onOpenManual={() => setShowManualTicketModal(true)}
          onConfirmarPagamento={handleConfirmarPagamento}
          onRemoverDaLista={handleRemoverDaLista}
          onValidate={() => navigate(`/validar/${selectedEventForParticipants.id}`)}
        />
      )}

      {/* Modal Gerar Ingresso Manual */}
      {selectedEventForParticipants && (
        <ManualTicketModal
          open={showManualTicketModal}
          onClose={() => setShowManualTicketModal(false)}
          event={selectedEventForParticipants}
          onGenerate={handleGenerateManualTicket}
        />
      )}

      {selectedRegForTicket && selectedEventForTicket && (
        <TicketModal
          isOpen={showTicketModal}
          onClose={() => setShowTicketModal(false)}
          event={selectedEventForTicket}
          registration={selectedRegForTicket}
        />
      )}
    </div>
  );
};
