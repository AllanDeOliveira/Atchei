import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { getFunctionsInstance } from '../lib/firebase';
import { storage } from '../lib/storage';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useRateLimit } from '../hooks/useRateLimit';
import { ArrowLeft } from 'lucide-react';

export const Login = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();


  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isLimited, remainingMs, trigger: triggerCooldown } = useRateLimit(3000);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimited) return;
    triggerCooldown();
    setIsLoading(true);
    try {
      const user = await storage.login(email, password);
      if (user) {
        if (user.mustChangePassword) {
          navigate('/change-password');
        } else {
          toast.success('Bem-vindo de volta!');
          navigate('/feed');
        }
      } else {
        toast.error('Senha ou Email incorreto!');
      }
    } catch (error) {
      console.error("Erro no login:", error);
      const code = (error as { code?: string })?.code;
      if (code === 'auth/too-many-requests') {
        toast.error('Tente novamente mais tarde.');
      } else if (code === 'auth/invalid-credential') {
        toast.error('Senha ou Email incorreto!');
      } else {
        toast.error('Ocorreu um erro ao tentar fazer login.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Digite seu e-mail acima para recuperar a senha.');
      return;
    }
    if (isLimited) return;
    triggerCooldown();
    try {
      // Function própria em vez de sendPasswordResetEmail: o Google não deixa
      // personalizar os templates deste projeto, então o e-mail e o link são
      // montados no servidor e apontam para /auth/action. Ela responde neutro
      // por design — conta inexistente não se distingue de envio feito.
      const solicitarResetSenha = httpsCallable(getFunctionsInstance(), 'solicitarResetSenha');
      await solicitarResetSenha({ email: email.trim() });
    } catch (error) {
      console.warn('Reset de senha:', error);
      // Só falha de transporte chega aqui; a function engole os erros de negócio.
      toast.error('Falha ao enviar. Verifique a conexão e tente novamente.');
      return;
    }
    toast.success('Se o e-mail estiver cadastrado, você receberá o link de redefinição.');
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <button
        // Sempre para o feed: o histórico atrás do login costuma ser rota protegida
        // (perfil, admin...) que devolve pro login — "voltar" ficava preso num pingue-pongue.
        onClick={() => navigate('/')}
        className="absolute top-8 left-6 p-2.5 rounded-xl bg-surface border border-glassBorder text-accent hover:border-accent/40 hover:bg-surfaceHover transition-all duration-300 neo-click z-20"
        title="Voltar"
        aria-label="Voltar"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="w-full max-w-sm flex flex-col items-center relative z-10">

        <div className="flex flex-col items-center gap-3 stagger-el mb-8">
          <img src={`${import.meta.env.BASE_URL}placeholder-logo.png`} alt="Atchei" className="w-24 h-24 object-contain brightness-110 drop-shadow-[0_4px_20px_rgba(255,179,77,0.35)]" />
          <h2 className="font-display font-semibold text-2xl text-accent mt-2">Login</h2>
        </div>

        <form onSubmit={handleLogin} className="w-full surface rounded-2xl p-6 space-y-5">
          <div className="stagger-el space-y-1.5">
            <label className="text-xs font-medium text-textMuted block ml-1">E-mail</label>
            <Input 
              type="email"
              placeholder="Seu e-mail" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          
          <div className="stagger-el space-y-1.5">
            <label className="text-xs font-medium text-textMuted block ml-1">Senha</label>
            <Input
              type="password"
              placeholder="Sua senha"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={handleForgotPassword}
              className="block ml-auto text-xs text-primary font-medium hover:underline cursor-pointer pt-1"
            >
              Esqueci minha senha
            </button>
          </div>

          <div className="stagger-el pt-4">
            <Button 
              type="submit" 
              variant="primary"
              fullWidth
              loading={isLoading}
              disabled={isLimited}
              className="py-4 text-sm"
            >
              {isLoading ? 'Entrando...' : isLimited ? `Aguarde ${Math.ceil(remainingMs / 1000)}s...` : 'Entrar'}
            </Button>
          </div>

          <p className="stagger-el text-center text-xs text-textMuted">
            Ainda não tem conta?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};
