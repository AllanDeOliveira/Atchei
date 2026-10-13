import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { goBack } from '../lib/utils';
import { storage, soldCount, STATUS_AGUARDANDO } from '../lib/storage';
import type { EventItem, AppProfile, Registration } from '../lib/storage';
import { Button } from '../components/ui/Button';
import { TicketModal } from '../components/TicketModal';
import { Calendar, Clock, MapPin, User, Ticket, Phone, Check } from 'lucide-react';
import toast from 'react-hot-toast';

import { formatDateExtenso, formatPhone, mapsDirUrl, mapsQuery, googleCalendarUrl, waMeUrl } from '../lib/formatters';
import { httpsCallable } from 'firebase/functions';
import { getFunctionsInstance } from '../lib/firebase';
import { EventHeader } from '../components/EventDetails/EventHeader';
import { EventLocationMap } from '../components/EventDetails/EventLocationMap';
import { EventTicketSection } from '../components/EventDetails/EventTicketSection';
import { Modal } from '../components/ui/Modal';


export const EventDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventItem | null>(null);
  // Inscrição do usuário logado neste evento (null = não confirmado/comprado).
  const [myReg, setMyReg] = useState<Registration | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();
  const userId = currentUser?.id;
  const [showContactsModal, setShowContactsModal] = useState(false);
  // Intenção de compra via WhatsApp: telefone do comprador antes de abrir o chat.
  const [showWhatsIntentModal, setShowWhatsIntentModal] = useState(false);
  const [whatsPhone, setWhatsPhone] = useState('');
  const [savingIntent, setSavingIntent] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [organizer, setOrganizer] = useState<AppProfile | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [registrationForTicket, setRegistrationForTicket] = useState<Registration | null>(null);
  // Geração de ingresso de teste (somente admin)
  const [loadingTestTicket, setLoadingTestTicket] = useState(false);

  // Mantém a referência da inscrição de teste para abrir o ingresso após gerar.
  const registrationForTicketRef = useRef<Registration | null>(null);

  // Confirmar presença exige conta (Termos de Uso; rules
  // do Firestore não aceitam mais inscrição de visitante).
  const exigirLogin = (): boolean => {
    if (currentUser) return true;
    toast.error('Entre na sua conta para continuar.');
    // ?next= traz a pessoa de volta a este evento depois de entrar/cadastrar.
    navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    return false;
  };

  // Firebase Instances
  const functions = getFunctionsInstance();

  // Gera um ingresso de teste (admin) e abre o resultante, para validar o fluxo de
  // portaria. Não cobra nada, não altera estoque nem faturamento real (backend marca isTeste).
  const handleGerarIngressoTeste = async () => {
    if (!event || loadingTestTicket) return;
    setLoadingTestTicket(true);
    try {
      // Usa o primeiro lote disponível (qty 1) quando o evento tem lotes; senão ingresso simples.
      const primeiroLote = (event.tickets || []).find(t => (t.capacity - soldCount(event, t)) > 0) || event.tickets?.[0];
      const itensSelecionados = primeiroLote
        ? [{ id: primeiroLote.id, name: primeiroLote.name, quantity: 1 }]
        : [];

      const criarIngressoTeste = httpsCallable(functions, 'criarIngressoTeste');
      const result = await criarIngressoTeste({ eventId: event.id, itensSelecionados });
      const data = result.data as { registrations?: Registration[] };
      const reg = data?.registrations?.[0];

      if (reg) {
        registrationForTicketRef.current = reg;
        setRegistrationForTicket(reg);
        setShowTicketModal(true);
        toast.success('Ingresso de teste gerado!');
      } else {
        toast.error('Não foi possível gerar o ingresso de teste.');
      }
    } catch (error) {
      console.error('Erro ao gerar ingresso de teste:', error);
      const message = error instanceof Error ? error.message : undefined;
      toast.error(message || 'Erro ao gerar o ingresso de teste.');
    } finally {
      setLoadingTestTicket(false);
    }
  };

  const loadEvent = useCallback(async () => {
    if (id) {
      setIsLoading(true);
      try {
        // Por id: listar a coleção para achar um custava 50 leituras por visita
        // e nem encontrava eventos além do 50º cadastrado.
        const found = await storage.getEventById(id);
        const currentUser = storage.getCurrentUser();
        if (found && found.isTestEvent && currentUser?.role !== 'admin') {
          setEvent(null);
        } else {
          setEvent(found || null);
        }

        if (found) {
          // Perfil de conta pessoal não é público (rules recusam a leitura): cai no
          // nome/foto gravados no evento na criação.
          const orgProfile = await storage.getProfileById(found.creatorId).catch(() => undefined);
          setOrganizer(
            orgProfile ??
              (found.creatorName
                ? { id: found.creatorId, name: found.creatorName, imageUrl: found.creatorImageUrl, type: 'user', description: '' }
                : null),
          );
        }

        if (userId) {
          setMyReg(await storage.getUserRegistration(id, userId));
        }
      } catch (error) {
        console.error("Erro ao carregar detalhes do evento:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [id, userId]);

  useEffect(() => {
    // Busca inicial de dados do evento ao montar/trocar de id — não estado
    // derivado, falso positivo da regra.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvent();
  }, [loadEvent]);


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
        <p className="text-accent font-sans font-medium">Evento não encontrado.</p>
        <Button onClick={() => navigate('/')}>Voltar ao início</Button>
      </div>
    );
  }

  // Confirmação de presença em 1 toque — funciona como "curtida" com peso social:
  // sem formulário, sem QR; os dados vêm da conta. O contador (registrationCount,
  // via trigger) alimenta o "Em alta" e a mensagem de prova social.
  const handleConfirmPresence = async () => {
    if (!event) return;
    if (!exigirLogin() || !currentUser) return;

    const registration: Registration = {
      id: Date.now().toString(),
      eventId: event.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.username,
      paymentStatus: 'Gratuito',
      timestamp: new Date().toISOString()
    };

    try {
      const docId = await storage.saveSelfRegistration(registration);
      setMyReg({ ...registration, id: docId });
      // Reflete no contador local sem esperar o trigger do backend.
      setEvent(prev => prev ? { ...prev, registrationCount: (prev.registrationCount || 0) + 1 } : prev);
      toast.success('Presença confirmada!');
    } catch (error) {
      console.error("Erro ao confirmar presença:", error);
      // permission-denied com teto definido = evento lotou entre o load e o clique.
      const lotou = (error as { code?: string })?.code === 'permission-denied' && event.maxParticipants != null;
      toast.error(lotou ? 'Evento esgotado! O limite de participantes foi atingido.' : 'Não foi possível confirmar. Tente novamente.');
    }
  };

  const handleCancelPresence = async () => {
    if (!myReg) return;
    // Intenção WhatsApp nunca entrou no contador de confirmados — só presença decrementa.
    const eraIntencao = myReg.paymentStatus === STATUS_AGUARDANDO;
    try {
      await storage.deleteRegistration(myReg.id);
      setMyReg(null);
      if (!eraIntencao) {
        setEvent(prev => prev ? { ...prev, registrationCount: Math.max(0, (prev.registrationCount || 0) - 1) } : prev);
      }
      toast(eraIntencao ? 'Compra cancelada.' : 'Presença cancelada.');
    } catch (error) {
      console.error("Erro ao cancelar presença:", error);
      toast.error('Não foi possível cancelar. Tente novamente.');
    }
  };

  // Abre o chat: contato único vai direto pro wa.me; vários, abre o modal de escolha.
  // `janela` é uma aba pré-aberta de forma síncrona no gesto do clique — obrigatória
  // quando houver um await antes daqui: o Safari/iOS bloqueia window.open fora do
  // gesto, e o chat nunca abriria (falha silenciosa, sem erro).
  const abrirChatWhatsApp = (janela?: Window | null) => {
    const contacts = event.whatsappContacts || [];
    if (contacts.length === 1) {
      const contact = contacts[0];
      const message = `Olá${contact.name ? ` ${contact.name}` : ''}! Tenho interesse no ingresso para o evento *${event.title}*`;
      const url = waMeUrl(contact.phone, message);
      if (janela) janela.location.href = url;
      else window.open(url, '_blank');
    } else {
      janela?.close();
      if (contacts.length > 1) setShowContactsModal(true);
    }
  };

  // Comprar via WhatsApp: antes de abrir o chat, o comprador entra na lista do
  // vendedor como 'Aguardando pagamento' (nome + WhatsApp visíveis pra ele).
  const handleWhatsAppBuy = () => {
    if (!exigirLogin() || !currentUser) return;
    if (myReg) {
      // Já está na lista (pendente ou confirmado): só reabre a conversa.
      abrirChatWhatsApp();
      return;
    }
    setShowWhatsIntentModal(true);
  };

  const handleConfirmarIntencao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const phoneDigits = whatsPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Informe seu WhatsApp com DDD.');
      return;
    }
    // A aba do chat precisa nascer AQUI, ainda dentro do gesto do submit: depois
    // do await o Safari/iOS bloquearia o window.open. Com vários contatos quem
    // abre é o modal de escolha, então não há aba a pré-abrir.
    const contatoUnico = (event.whatsappContacts || []).length === 1;
    const chatWin = contatoUnico ? window.open('', '_blank') : null;
    setSavingIntent(true);
    try {
      const registration: Registration = {
        id: '',
        eventId: event.id,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.username,
        userPhone: phoneDigits,
        paymentStatus: STATUS_AGUARDANDO,
        timestamp: new Date().toISOString(),
      };
      const docId = await storage.saveSelfRegistration(registration);
      setMyReg({ ...registration, id: docId });
      setShowWhatsIntentModal(false);
      abrirChatWhatsApp(chatWin);
    } catch (error) {
      chatWin?.close();
      console.error('Erro ao registrar intenção de compra:', error);
      toast.error('Não foi possível registrar. Tente novamente.');
    } finally {
      setSavingIntent(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/e/${event.id}`;
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: event.description,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link do evento copiado!');
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background pb-[calc(15rem+env(safe-area-inset-bottom))] md:pb-16 px-4 md:px-8 pt-6">

      {/* Main Responsive Grid Container */}
      <div className="w-full max-w-7xl mx-auto relative flex flex-col">

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* LEFT COLUMN: Media Carousel, Title, About, Location */}
          <div className="lg:col-span-2 space-y-6">

            <EventHeader
              title={event.title}
              mediaUrls={event.mediaUrls}
              currentMediaIndex={currentMediaIndex}
              onCurrentMediaIndexChange={setCurrentMediaIndex}
              onBack={() => goBack(navigate)}
              onShare={handleShare}
            />

            {/* About Section */}
            <div className="text-left space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 bg-primary/40 rounded-full" />
                <h2 className="font-display font-semibold text-xl text-textLight">Sobre o evento</h2>
              </div>
              <div className="relative overflow-hidden surface p-6 rounded-2xl">
                <p className="text-textLight text-sm leading-relaxed whitespace-pre-wrap font-sans relative z-10">
                  {event.description}
                </p>
              </div>
            </div>

            <EventLocationMap
              location={event.location}
              address={event.address || ''}
            />

          </div>

          {/* RIGHT COLUMN: Ticket Info/Actions (Sticky on Desktop), Date/Time/Organizer Info */}
          <div className="space-y-6 lg:sticky lg:top-6">

            <EventTicketSection
              event={event}
              currentUser={currentUser}
              myRegistration={myReg}
              loadingTestTicket={loadingTestTicket}
              onConfirmPresence={handleConfirmPresence}
              onCancelPresence={handleCancelPresence}
              onWhatsAppBuy={handleWhatsAppBuy}
              onGerarIngressoTeste={handleGerarIngressoTeste}
            />

            {/* Consolidado de Informações do Evento (Data, Hora, Organizador e GPS Curto) */}
            <div className="surface rounded-2xl p-6 text-left space-y-5">
              <span className="text-xs font-medium text-accent block mb-1">
                Informações do evento
              </span>

              {/* Grid de Data e Horário */}
              <div className="grid grid-cols-2 gap-4 pb-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-accent">
                    <Calendar size={13} />
                    <span className="text-xs font-medium">Data</span>
                  </div>
                  <p className="text-sm font-sans font-semibold text-textLight leading-tight">{formatDateExtenso(event.date)}</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-accent">
                    <Clock size={13} />
                    <span className="text-xs font-medium">Horário</span>
                  </div>
                  <p className="text-sm font-sans font-semibold text-textLight leading-tight">{event.time}h</p>
                </div>
              </div>

              <button
                onClick={() => window.open(googleCalendarUrl(event.title, event.date, event.time, mapsQuery(event.location, event.address), event.description), '_blank')}
                className="w-full mb-4 bg-surface border border-glassBorder hover:bg-surfaceHover hover:border-primary/30 text-textLight font-sans font-semibold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-200 neo-click cursor-pointer"
              >
                <Calendar size={13} /> Adicionar ao calendário
              </button>

              {/* Bloco do Organizador */}
              {organizer && (
                <div className="flex items-center justify-between gap-3 pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-surface/85 overflow-hidden flex items-center justify-center text-accent">
                        {organizer.imageUrl ? (
                          <img src={organizer.imageUrl} className="w-full h-full object-cover" alt={organizer.name} />
                        ) : (
                          <User size={16} />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-accent text-textDark border-2 border-surface flex items-center justify-center shadow-sm">
                        <Check size={9} strokeWidth={3} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-accent">Organizado por</p>
                      <p className="font-sans font-semibold text-sm text-textLight mt-0.5 leading-tight">{organizer.name}</p>
                    </div>
                  </div>
                  {/* Só perfil profissional tem agenda pública; conta pessoal daria "não encontrado". */}
                  {organizer.type === 'profissional' && (
                    <button
                      onClick={() => navigate(`/agenda/${organizer.id}`)}
                      className="bg-primary text-textDark font-sans font-semibold text-xs px-3.5 py-2 rounded-xl transition-all duration-200 neo-click hover:bg-primaryHover cursor-pointer shrink-0"
                    >
                      Ver perfil
                    </button>
                  )}
                </div>
              )}

              {/* Endereço / GPS Curto */}
              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-accent shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-sans font-semibold text-sm text-textLight truncate">{event.location}</p>
                    {event.address && <p className="text-xs text-textMuted font-sans mt-0.5 leading-snug">{event.address}</p>}
                  </div>
                </div>
                <button
                  onClick={() => window.open(mapsDirUrl(event.location, event.address), '_blank')}
                  className="w-full bg-surface border border-glassBorder hover:bg-surfaceHover hover:border-primary/30 text-textLight font-sans font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-200 neo-click cursor-pointer"
                >
                  <MapPin size={14} /> Traçar rota no GPS
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Intenção de compra via WhatsApp: pega o telefone e entra na lista do vendedor */}
      <Modal
        open={showWhatsIntentModal}
        onClose={() => setShowWhatsIntentModal(false)}
        labelledBy="whats-intent-title"
        backdropClassName="fixed inset-0 z-50 flex items-center justify-center px-4 modal-backdrop"
        className="glass border-none rounded-[2.5rem] p-8 max-w-sm md:max-w-lg w-full text-center relative overflow-hidden backdrop-blur-3xl shadow-float bg-surface/98"
      >
            <button onClick={() => setShowWhatsIntentModal(false)} className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 p-2 rounded-2xl text-textLight transition-all duration-300 cursor-pointer neo-click">
              <span className="sr-only">Fechar</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 id="whats-intent-title" className="font-display text-xl font-semibold text-accent mb-1 mt-2">Quase lá!</h3>
            <p className="text-xs text-textMuted mb-6 leading-relaxed max-w-[280px] mx-auto">
              Deixe seu WhatsApp para o vendedor te identificar. Quando ele confirmar o
              pagamento, seu ingresso aparece automaticamente no seu perfil.
            </p>
            <form onSubmit={handleConfirmarIntencao} className="space-y-4 text-left">
              <div>
                <label htmlFor="whats-intent-phone" className="text-xs font-medium text-accent ml-1 mb-1.5 block">Seu WhatsApp</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted" />
                  <input
                    id="whats-intent-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(65) 99999-9999"
                    value={whatsPhone}
                    onChange={(e) => setWhatsPhone(formatPhone(e.target.value))}
                    className="w-full bg-surface border border-glassBorder rounded-xl py-3.5 pl-11 pr-4 text-sm text-textLight placeholder:text-textMuted/50 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingIntent}
                className="w-full rounded-xl py-4 flex items-center justify-center gap-2 font-sans font-semibold text-sm bg-success text-textDark hover:brightness-95 transition-all duration-200 cursor-pointer neo-click disabled:opacity-60"
              >
                <Ticket size={16} />
                {savingIntent ? 'Registrando…' : 'Continuar para o WhatsApp'}
              </button>
            </form>
      </Modal>

      {/* Contacts Modal */}
      <Modal
        open={showContactsModal}
        onClose={() => setShowContactsModal(false)}
        labelledBy="event-contacts-title"
        backdropClassName="fixed inset-0 z-50 flex items-center justify-center px-4 modal-backdrop"
        className="glass border-none rounded-[2.5rem] p-8 max-w-sm md:max-w-lg w-full text-center max-h-[80vh] flex flex-col relative overflow-hidden backdrop-blur-3xl shadow-float bg-surface/98"
      >
            <button onClick={() => setShowContactsModal(false)} className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 p-2 rounded-2xl text-textLight transition-all duration-300 cursor-pointer neo-click">
              <span className="sr-only">Fechar</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 id="event-contacts-title" className="font-display text-xl font-semibold text-accent mb-1 mt-2">Comprar ingresso</h3>
            <p className="text-xs text-textMuted mb-6 leading-relaxed max-w-[240px] mx-auto">
              Escolha com qual promoter você deseja falar para garantir sua vaga:
            </p>
            <div className="space-y-3 overflow-y-auto pr-2 pb-4 flex-1">
              {(event?.whatsappContacts || []).map((contact, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const message = `Olá${contact.name ? ` ${contact.name}` : ''}! Tenho interesse no ingresso para o evento *${event?.title}*`;
                      window.open(waMeUrl(contact.phone, message), '_blank');
                    }}
                    className="w-full surface hover:border-primary/30 rounded-xl p-4 flex items-center justify-between group hover:bg-surfaceHover transition-all duration-200 neo-click cursor-pointer"
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className="font-sans font-semibold text-sm md:text-base text-textLight group-hover:text-accent transition-colors">{contact.name || 'Promoter'}</span>
                      <span className="text-xs md:text-sm text-textMuted font-mono mt-0.5">{contact.phone}</span>
                    </div>
                    <Ticket className="text-accent/70 group-hover:text-accent transition-colors" size={18} />
                  </button>
                ))}
            </div>
            <button
              onClick={() => setShowContactsModal(false)}
              className="w-full bg-surface hover:bg-surfaceHover text-textLight border border-glassBorder font-sans font-medium py-3.5 rounded-xl transition-all duration-200 active:scale-95 text-sm mt-4 cursor-pointer"
            >
              Cancelar
            </button>
      </Modal>

      {registrationForTicket && (
        <TicketModal
          isOpen={showTicketModal}
          onClose={() => setShowTicketModal(false)}
          event={event}
          registration={registrationForTicket}
        />
      )}
    </div>
  );
};
