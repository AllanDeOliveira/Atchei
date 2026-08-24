import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Lock, ShieldCheck, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Handler próprio das ações de e-mail do Firebase Auth (redefinir senha, verificar
 * e-mail, reverter troca de e-mail). Substitui a tela padrão em
 * `<projeto>.firebaseapp.com/__/auth/action`, que não tem identidade visual nenhuma.
 *
 * Para entrar em uso, cada template em Authentication → Modelos precisa apontar
 * "Personalizar URL de ação" para https://atchei.web.app/auth/action — o Firebase
 * manda os mesmos parâmetros (mode, oobCode, continueUrl, lang) para cá.
 *
 * Todos os modos são tratados de propósito: trocar a URL de ação afeta TODOS os
 * e-mails do projeto, então um modo não previsto viraria tela quebrada.
 */

type Estado =
  | { fase: 'verificando' }
  | { fase: 'form_senha'; email: string }
  | { fase: 'sucesso'; titulo: string; mensagem: string }
  | { fase: 'erro'; mensagem: string };

// O oobCode é de uso único e expira. Traduz os códigos do SDK para algo acionável.
const mensagemDeErro = (code: string | undefined): string => {
  switch (code) {
    case 'auth/expired-action-code':
      return 'Este link expirou. Peça um novo na tela de login.';
    case 'auth/invalid-action-code':
      return 'Este link não é mais válido. Ele já foi usado ou substituído por um mais recente.';
    case 'auth/user-disabled':
      return 'Esta conta está desativada. Fale com o suporte.';
    case 'auth/user-not-found':
      return 'Não encontramos a conta ligada a este link.';
    case 'auth/weak-password':
      return 'Senha muito fraca. Use pelo menos 6 caracteres.';
    default:
      return 'Não foi possível concluir. Tente novamente ou peça um link novo.';
  }
};

export const AuthAction = () => {
  const [params] = useSearchParams();

  const mode = params.get('mode');
  const oobCode = params.get('oobCode');

  const [estado, setEstado] = useState<Estado>({ fase: 'verificando' });
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!mode || !oobCode) {
      setEstado({ fase: 'erro', mensagem: 'Link incompleto. Abra o link direto do e-mail, sem editar o endereço.' });
      return;
    }

    let cancelado = false;

    (async () => {
      try {
        if (mode === 'resetPassword') {
          const email = await verifyPasswordResetCode(auth, oobCode);
          if (!cancelado) setEstado({ fase: 'form_senha', email });
          return;
        }

        if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode);
          if (!cancelado) {
            setEstado({
              fase: 'sucesso',
              titulo: 'E-mail confirmado',
              mensagem: 'Seu endereço foi verificado. Já pode usar sua conta normalmente.',
            });
          }
          return;
        }

        if (mode === 'recoverEmail') {
          await applyActionCode(auth, oobCode);
          if (!cancelado) {
            setEstado({
              fase: 'sucesso',
              titulo: 'E-mail restaurado',
              mensagem: 'A alteração foi revertida. Se não foi você quem pediu a troca, redefina sua senha agora.',
            });
          }
          return;
        }

        if (!cancelado) {
          setEstado({ fase: 'erro', mensagem: 'Este tipo de link não é reconhecido pelo app.' });
        }
      } catch (error) {
        if (!cancelado) {
          setEstado({ fase: 'erro', mensagem: mensagemDeErro((error as { code?: string })?.code) });
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [mode, oobCode]);

  const salvarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm('');

    if (novaSenha.length < 6) {
      setErroForm('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErroForm('As senhas não coincidem.');
      return;
    }
    if (!oobCode) return;

    setSalvando(true);
    try {
      await confirmPasswordReset(auth, oobCode, novaSenha);
      setEstado({
        fase: 'sucesso',
        titulo: 'Senha alterada',
        mensagem: 'Pronto! Use a senha nova para entrar.',
      });
    } catch (error) {
      setErroForm(mensagemDeErro((error as { code?: string })?.code));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-sm flex flex-col items-center relative z-10">
        {estado.fase === 'verificando' && (
          <>
            <div className="mb-6 w-20 h-20 border border-primary/20 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
              <Loader2 size={36} className="animate-spin" />
            </div>
            <p className="text-xs text-textMuted text-center">Validando seu link…</p>
          </>
        )}

        {estado.fase === 'form_senha' && (
          <>
            <div className="stagger-el mb-6 w-20 h-20 border border-primary/20 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
              <ShieldCheck size={36} />
            </div>

            <h1 className="stagger-el font-display italic font-semibold text-3xl text-textLight mb-2">Nova senha</h1>
            <p className="stagger-el text-xs text-textMuted text-center mb-8 leading-relaxed">
              Definindo a senha de<br />
              <strong className="text-textLight">{estado.email}</strong>
            </p>

            <form onSubmit={salvarSenha} className="w-full space-y-5">
              <div className="stagger-el space-y-1.5 text-left">
                <label className="text-xs font-medium text-textMuted ml-1.5 flex items-center gap-2">
                  <Lock size={14} className="text-primary" />
                  Nova senha
                </label>
                <div className="relative">
                  <Input
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    required
                    autoComplete="new-password"
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-primary hover:text-accent transition-colors duration-300"
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="stagger-el space-y-1.5 text-left">
                <label className="text-xs font-medium text-textMuted ml-1.5 flex items-center gap-2">
                  <Lock size={14} className="text-primary" />
                  Confirmar senha
                </label>
                <Input
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="Repita a nova senha"
                  required
                  autoComplete="new-password"
                  value={confirmarSenha}
                  onChange={e => setConfirmarSenha(e.target.value)}
                />
              </div>

              {erroForm && (
                <div className="stagger-el bg-danger/10 border border-danger/20 text-danger text-xs px-4 py-3 rounded-xl text-center shadow-sm">
                  {erroForm}
                </div>
              )}

              <div className="stagger-el pt-4 flex justify-center">
                <Button type="submit" variant="primary" fullWidth loading={salvando} className="rounded-xl py-4 font-sans font-semibold text-base">
                  {salvando ? 'Salvando...' : 'Salvar nova senha'}
                </Button>
              </div>
            </form>
          </>
        )}

        {estado.fase === 'sucesso' && (
          <>
            <div className="stagger-el mb-6 w-20 h-20 border border-emerald-500/20 rounded-2xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="stagger-el font-display italic font-semibold text-3xl text-textLight mb-2">{estado.titulo}</h1>
            <p className="stagger-el text-xs text-textMuted text-center mb-8 leading-relaxed">{estado.mensagem}</p>
            <Link to="/login" className="stagger-el w-full">
              <Button variant="primary" fullWidth className="rounded-xl py-4 font-sans font-semibold text-base">
                Ir para o login
              </Button>
            </Link>
          </>
        )}

        {estado.fase === 'erro' && (
          <>
            <div className="stagger-el mb-6 w-20 h-20 border border-danger/20 rounded-2xl flex items-center justify-center bg-danger/10 text-danger">
              <AlertTriangle size={36} />
            </div>
            <h1 className="stagger-el font-display italic font-semibold text-3xl text-textLight mb-2">Link inválido</h1>
            <p className="stagger-el text-xs text-textMuted text-center mb-8 leading-relaxed">{estado.mensagem}</p>
            <Link to="/login" className="stagger-el w-full">
              <Button variant="primary" fullWidth className="rounded-xl py-4 font-sans font-semibold text-base">
                Voltar ao login
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
