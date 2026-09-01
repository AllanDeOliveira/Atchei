import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storage } from '../lib/storage';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useRateLimit } from '../hooks/useRateLimit';
import { ArrowLeft } from 'lucide-react';
import { goBack } from '../lib/utils';

// Idade em anos completos a partir de uma data YYYY-MM-DD (sem fuso: parse manual).
const calcularIdade = (iso: string): number => {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) idade--;
  return idade;
};

export const Register = () => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tipo, setTipo] = useState<'user' | 'profissional'>('user');
  const [isLoading, setIsLoading] = useState(false);
  const { isLimited, remainingMs, trigger: triggerCooldown } = useRateLimit(3000);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimited) return;
    if (name.trim().length < 2) {
      toast.error('Informe seu nome.');
      return;
    }
    if (!birthDate || calcularIdade(birthDate) < 18) {
      toast.error('Você precisa ter 18 anos ou mais para criar uma conta.');
      return;
    }
    triggerCooldown();
    setIsLoading(true);
    try {
      await storage.register(email, password, name.trim(), tipo, birthDate);
      toast.success('Conta criada! Bem-vindo.');
      navigate('/feed');
    } catch (error) {
      const code = (error as { code?: string })?.code;
      console.error('Erro no cadastro:', error);
      if (code === 'auth/email-already-in-use') {
        toast.error('Este e-mail já está em uso. Tente fazer login.');
      } else if (code === 'auth/weak-password') {
        toast.error('A senha precisa ter pelo menos 6 caracteres.');
      } else if (code === 'auth/invalid-email') {
        toast.error('E-mail inválido.');
      } else {
        toast.error('Não foi possível criar a conta. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <button
        onClick={() => goBack(navigate, '/login')}
        className="absolute top-8 left-6 p-2.5 rounded-xl bg-surface border border-glassBorder text-accent hover:border-accent/40 hover:bg-surfaceHover transition-all duration-300 neo-click z-20"
        title="Voltar"
        aria-label="Voltar"
      >
        <ArrowLeft size={20} />
      </button>
      <div className="w-full max-w-sm flex flex-col items-center relative z-10">

        <div className="flex flex-col items-center gap-3 stagger-el mb-8">
          <img src={`${import.meta.env.BASE_URL}placeholder-logo.png`} alt="Atchei" className="w-24 h-24 object-contain brightness-110 drop-shadow-[0_4px_20px_rgba(255,179,77,0.35)]" />
          <h2 className="font-display font-semibold text-2xl text-accent mt-2">Criar conta</h2>
        </div>

        <form onSubmit={handleRegister} className="w-full surface rounded-2xl p-6 space-y-5">
          <div className="stagger-el space-y-1.5">
            <label className="text-xs font-medium text-textMuted block ml-1">Tipo de perfil</label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de perfil">
              {([
                { valor: 'user', titulo: 'Pessoal', descricao: 'Participar de eventos e garantir ingressos' },
                { valor: 'profissional', titulo: 'Profissional', descricao: 'Criar eventos e vender ingressos' },
              ] as const).map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  role="radio"
                  aria-checked={tipo === opcao.valor}
                  onClick={() => setTipo(opcao.valor)}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    tipo === opcao.valor
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-glassBorder bg-surfaceHover/40 hover:border-primary/25'
                  }`}
                >
                  <span className={`block text-sm font-semibold ${tipo === opcao.valor ? 'text-primary' : 'text-textLight'}`}>
                    {opcao.titulo}
                  </span>
                  <span className="block text-[11px] text-textMuted mt-0.5 leading-snug">{opcao.descricao}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="stagger-el space-y-1.5">
            <label className="text-xs font-medium text-textMuted block ml-1">Nome</label>
            <Input
              type="text"
              placeholder="Seu nome"
              required
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="stagger-el space-y-1.5">
            <label className="text-xs font-medium text-textMuted block ml-1">Data de nascimento</label>
            <Input
              type="date"
              required
              aria-label="Data de nascimento"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setBirthDate(e.target.value)}
            />
            <p className="text-[10px] text-textMuted ml-1">É necessário ter 18 anos ou mais.</p>
          </div>

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
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <p className="stagger-el text-[11px] text-textMuted leading-snug text-center pt-1">
            Ao criar a conta, você concorda com os{' '}
            <Link to="/termos" className="text-primary underline underline-offset-2">Termos de Uso</Link>{' '}
            e a{' '}
            <Link to="/privacidade" className="text-primary underline underline-offset-2">Política de Privacidade</Link>.
          </p>

          <div className="stagger-el pt-2">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isLoading}
              disabled={isLimited}
              className="py-4 text-sm"
            >
              {isLoading ? 'Criando conta...' : isLimited ? `Aguarde ${Math.ceil(remainingMs / 1000)}s...` : 'Criar conta'}
            </Button>
          </div>

          <p className="stagger-el text-center text-xs text-textMuted">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Fazer login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};
