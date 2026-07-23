import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getRecoveryAuth, getRecoveryFunctionsInstance } from '../lib/firebase';
import { Ticket, Search, ArrowLeft, Calendar, CheckCircle2, QrCode, Mail, MailCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { TicketModal } from '../components/TicketModal';
import type { EventItem, Registration } from '../lib/storage';

type RecoveredTicket = { registration: Registration; event: EventItem };

// Onde guardamos o e-mail entre o "enviar link" e o retorno pelo link mágico.
// Necessário porque o clique no e-mail recarrega o app numa nova aba/sessão.
const STORAGE_KEY = '@chain:recoveryEmail';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Habilita a recuperação por LINK DE E-MAIL. Desligado enquanto não houver um SMTP
// próprio configurado no Firebase (o serviço de e-mail nativo não entrega). Com o
// SMTP no ar, mude para `true` e faça deploy do hosting — nada mais precisa mudar.
// O login com Google não depende disso: funciona sem envio de e-mail.
const EMAIL_LINK_ENABLED = false;

type Phase = 'idle' | 'link_sent' | 'verifying' | 'done';

// Logo "G" do Google (4 cores) — lucide não traz o ícone de marca.
const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return dateStr;
};

export const RecuperarIngresso = () => {
  const navigate = useNavigate();

  // Detecta uma única vez (por montagem) se a URL atual é um link mágico de retorno.
  // useMemo em vez de ref: a regra react-hooks/refs proíbe ler refs durante o render.
  const isMagicLink = useMemo((): boolean => {
    try {
      return isSignInWithEmailLink(getRecoveryAuth(), window.location.href);
    } catch {
      return false;
    }
  }, []);

  const [email, setEmail] = useState('');
  // Estado inicial derivado da URL — evita setState síncrono no efeito de montagem.
  const [phase, setPhase] = useState<Phase>(isMagicLink ? 'verifying' : 'idle');
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Quando o link é aberto em outro dispositivo, o e-mail não está no storage:
  // pedimos que a pessoa reinforme para concluir a verificação.
  const [needEmailForVerify, setNeedEmailForVerify] = useState(
    isMagicLink && !localStorage.getItem(STORAGE_KEY)
  );
  const [tickets, setTickets] = useState<RecoveredTicket[]>([]);
  const [selected, setSelected] = useState<RecoveredTicket | null>(null);
  const [showTicket, setShowTicket] = useState(false);
  // StrictMode monta o efeito duas vezes em dev; o link mágico só pode ser
  // consumido uma vez, então guardamos para não chamar signIn duas vezes.
  const completedRef = useRef(false);

  // Busca os ingressos do usuário autenticado (sessão efêmera já estabelecida).
  // Usado tanto pelo login com Google quanto pelo retorno do link mágico.
  const fetchMyTickets = useCallback(async () => {
    const functions = getRecoveryFunctionsInstance();
    const recuperar = httpsCallable(functions, 'recuperarMeusIngressos');
    const result = await recuperar({});
    const data = result.data as { ingressos?: RecoveredTicket[] };
    setTickets(data?.ingressos || []);
    setPhase('done');
  }, []);

  // Entrar com Google: prova posse do e-mail via OAuth (sem enviar e-mail nenhum).
  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const auth = getRecoveryAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      await fetchMyTickets();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      // Fechar o popup não é erro — só ignora.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('Erro ao entrar com Google:', error);
        toast.error('Não foi possível entrar com o Google. Tente novamente.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Conclui a verificação: troca o link mágico por uma sessão efêmera e busca os ingressos.
  const completeSignIn = useCallback(async (emailForLink: string) => {
    try {
      const auth = getRecoveryAuth();
      await signInWithEmailLink(auth, emailForLink, window.location.href);
      localStorage.removeItem(STORAGE_KEY);
      // Remove os parâmetros do link mágico da URL (evita reprocessar no refresh).
      window.history.replaceState({}, '', '/ingresso');
      await fetchMyTickets();
    } catch (error) {
      console.error('Erro ao verificar o link de recuperação:', error);
      toast.error('Link inválido ou expirado. Solicite um novo abaixo.');
      setNeedEmailForVerify(false);
      setPhase('idle');
    }
  }, [fetchMyTickets]);

  // Ao montar: se a URL for um link mágico e já tivermos o e-mail salvo, conclui a
  // verificação automaticamente. `phase`/`needEmailForVerify` já vieram do init acima.
  useEffect(() => {
    if (!isMagicLink || completedRef.current) return;
    completedRef.current = true;
    const stored = localStorage.getItem(STORAGE_KEY);
    // completeSignIn só chama setState APÓS os awaits de rede (padrão async sancionado
    // pela própria doc da regra), nunca de forma síncrona no corpo do efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) completeSignIn(stored);
  }, [isMagicLink, completeSignIn]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const emailTrim = email.trim();
    if (!emailRegex.test(emailTrim)) {
      toast.error('Digite um e-mail válido.');
      return;
    }

    setSending(true);
    try {
      const auth = getRecoveryAuth();
      await sendSignInLinkToEmail(auth, emailTrim, {
        url: `${window.location.origin}/ingresso`,
        handleCodeInApp: true,
      });
      localStorage.setItem(STORAGE_KEY, emailTrim);
      setPhase('link_sent');
    } catch (error) {
      console.error('Erro ao enviar o link de recuperação:', error);
      toast.error('Não foi possível enviar o link agora. Tente novamente em instantes.');
    } finally {
      setSending(false);
    }
  };

  // Conclui a verificação quando a pessoa reinforma o e-mail (fluxo de outro dispositivo).
  const handleConfirmEmailForVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrim = email.trim();
    if (!emailRegex.test(emailTrim)) {
      toast.error('Digite o e-mail que recebeu o link.');
      return;
    }
    setNeedEmailForVerify(false);
    await completeSignIn(emailTrim);
  };

  const abrirIngresso = (t: RecoveredTicket) => {
    setSelected(t);
    setShowTicket(true);
  };

  const resetToIdle = () => {
    setPhase('idle');
    setNeedEmailForVerify(false);
  };

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <div className="w-full max-w-md">
        {/* Voltar */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-textMuted hover:text-textLight text-sm font-medium mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        {/* Cabeçalho */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-4">
            <Ticket size={28} />
          </div>
          <h1 className="font-display font-semibold text-2xl text-textLight leading-tight">Recuperar ingresso</h1>
          <p className="text-sm text-textMuted mt-1.5 leading-relaxed">
            Comprou sem fazer login? Entre com a <strong className="text-textLight">conta Google</strong> do
            e-mail usado na compra para acessar seus ingressos.
          </p>
        </div>

        {/* Verificando link mágico */}
        {phase === 'verifying' && !needEmailForVerify && (
          <div className="surface rounded-2xl p-8 shadow-sm flex flex-col items-center gap-3 text-center">
            <Loader2 size={28} className="text-primary animate-spin" />
            <p className="text-sm text-textMuted">Verificando seu link de acesso…</p>
          </div>
        )}

        {/* Link aberto em outro dispositivo: reinformar e-mail para concluir */}
        {phase === 'verifying' && needEmailForVerify && (
          <form onSubmit={handleConfirmEmailForVerify} className="surface rounded-2xl p-5 shadow-sm space-y-4">
            <p className="text-sm text-textMuted leading-relaxed">
              Para sua segurança, confirme o <strong className="text-textLight">e-mail</strong> que recebeu o link.
            </p>
            <Input
              label="E-mail"
              leftIcon={<Mail size={18} />}
              type="email"
              inputMode="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Button type="submit" variant="primary" fullWidth className="rounded-xl py-3.5">
              <CheckCircle2 size={18} /> Confirmar e ver ingressos
            </Button>
          </form>
        )}

        {/* Link enviado */}
        {phase === 'link_sent' && (
          <div className="surface rounded-2xl p-6 shadow-sm text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-success/10 text-success flex items-center justify-center">
              <MailCheck size={26} />
            </div>
            <h2 className="font-display font-semibold text-lg text-textLight">Link enviado!</h2>
            <p className="text-sm text-textMuted leading-relaxed">
              Enviamos um link de acesso para <strong className="text-textLight break-all">{email.trim()}</strong>.
              Abra seu e-mail e toque no link para ver seus ingressos. Pode fechar esta aba.
            </p>
            <button
              type="button"
              onClick={resetToIdle}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              Usar outro e-mail
            </button>
          </div>
        )}

        {/* Tela inicial: Google como via principal (não depende de e-mail) */}
        {phase === 'idle' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white text-stone-800 border border-glassBorder rounded-xl py-3.5 font-sans font-semibold text-sm shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleLoading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
              {googleLoading ? 'Entrando…' : 'Entrar com Google'}
            </button>

            {/* Reforço por link de e-mail — só aparece quando um SMTP estiver configurado */}
            {EMAIL_LINK_ENABLED && (
              <>
                <div className="flex items-center gap-3 text-textMuted/60">
                  <div className="h-px flex-1 bg-glassBorder" />
                  <span className="text-xs">ou</span>
                  <div className="h-px flex-1 bg-glassBorder" />
                </div>
                <form onSubmit={handleSendLink} className="surface rounded-2xl p-5 shadow-sm space-y-4">
                  <Input
                    label="E-mail da compra"
                    leftIcon={<Mail size={18} />}
                    type="email"
                    inputMode="email"
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={sending}
                    className="rounded-xl py-3.5"
                  >
                    {!sending && <Search size={18} />}
                    {sending ? 'Enviando…' : 'Enviar link de acesso'}
                  </Button>
                </form>
              </>
            )}
          </div>
        )}

        {/* Resultados */}
        {phase === 'done' && (
          <div className="mt-2">
            {tickets.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-textMuted/10 flex items-center justify-center mb-3">
                  <Search size={22} className="text-textMuted/50" />
                </div>
                <p className="text-sm text-textMuted">
                  Nenhum ingresso encontrado para este e-mail. Confira se é o mesmo e-mail usado na compra.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-medium text-textMuted px-1">
                  {tickets.length} ingresso{tickets.length !== 1 ? 's' : ''} encontrado{tickets.length !== 1 ? 's' : ''}
                </p>
                {tickets.map((t) => (
                  <button
                    type="button"
                    key={t.registration.id}
                    onClick={() => abrirIngresso(t)}
                    className="w-full surface surface-hover rounded-2xl p-4 flex items-center gap-3 text-left cursor-pointer group"
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                      <QrCode size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-sm text-textLight truncate">{t.event.title}</h3>
                      <div className="flex items-center gap-1.5 text-textMuted mt-0.5">
                        <Calendar size={12} />
                        <span className="text-xs">{formatDateBR(t.event.date)}</span>
                        {t.registration.ticketTypeName && (
                          <span className="text-xs truncate">· {t.registration.ticketTypeName}</span>
                        )}
                      </div>
                    </div>
                    {t.registration.checkedIn ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-textMuted bg-textMuted/10 px-2 py-1 rounded-lg">
                        <CheckCircle2 size={12} /> Usado
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-success bg-success/10 px-2 py-1 rounded-lg">
                        <CheckCircle2 size={12} /> Válido
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal do ingresso (reaproveita o componente padrão com QR + download) */}
      {selected && (
        <TicketModal
          isOpen={showTicket}
          onClose={() => setShowTicket(false)}
          event={selected.event}
          registration={selected.registration}
        />
      )}
    </div>
  );
};
