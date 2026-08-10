import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Wallet, CheckCircle2, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getFunctionsInstance } from '../lib/firebase';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { formatCPF, formatPhone, isValidCPF } from '../lib/formatters';

type Status = { connected: boolean; feePercent?: number };

const VAZIO = {
  name: '',
  email: '',
  cpfCnpj: '',
  mobilePhone: '',
  postalCode: '',
  address: '',
  addressNumber: '',
  complement: '',
  province: '',
  incomeValue: '',
};

/**
 * Cadastro da conta de recebimento do organizador no Asaas.
 * Ao contrário do fluxo OAuth do Mercado Pago (redirect + autorização), aqui os dados
 * cadastrais são enviados ao backend, que cria a subconta e guarda o walletId do split.
 */
export const AsaasRecebedor = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});

  useEscapeToClose(aberto, () => setAberto(false));

  const carregarStatus = useCallback(async () => {
    try {
      const fn = httpsCallable<unknown, Status>(getFunctionsInstance(), 'asaasStatusRecebedor');
      const { data } = await fn({});
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const fn = httpsCallable<unknown, Status>(getFunctionsInstance(), 'asaasStatusRecebedor');
      try {
        const { data } = await fn({});
        if (vivo) setStatus(data);
      } catch {
        if (vivo) setStatus({ connected: false });
      }
    })();
    return () => { vivo = false; };
  }, []);

  const set = (campo: keyof typeof VAZIO, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => (e[campo] ? { ...e, [campo]: '' } : e));
  };

  // Espelha a validação do backend: erro no campo é melhor do que 400 genérico do Asaas.
  const validar = () => {
    const e: Record<string, string> = {};
    const doc = form.cpfCnpj.replace(/\D/g, '');
    const cep = form.postalCode.replace(/\D/g, '');

    if (form.name.trim().length < 3) e.name = 'Informe o nome completo ou razão social.';
    if (!form.email.includes('@')) e.email = 'E-mail inválido.';
    if (doc.length === 11 ? !isValidCPF(doc) : doc.length !== 14) e.cpfCnpj = 'CPF ou CNPJ inválido.';
    if (form.mobilePhone.replace(/\D/g, '').length < 10) e.mobilePhone = 'Celular incompleto.';
    if (cep.length !== 8) e.postalCode = 'CEP deve ter 8 dígitos.';
    if (!form.address.trim()) e.address = 'Informe o logradouro.';
    if (!form.addressNumber.trim()) e.addressNumber = 'Informe o número.';
    if (!form.province.trim()) e.province = 'Informe o bairro.';
    if (!(Number(form.incomeValue) > 0)) e.incomeValue = 'Informe um valor maior que zero.';

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validar()) {
      toast.error('Revise os campos destacados.');
      return;
    }

    setSalvando(true);
    try {
      const fn = httpsCallable(getFunctionsInstance(), 'asaasCadastrarRecebedor');
      await fn({
        ...form,
        cpfCnpj: form.cpfCnpj.replace(/\D/g, ''),
        postalCode: form.postalCode.replace(/\D/g, ''),
        incomeValue: Number(form.incomeValue),
      });
      toast.success('Conta de recebimento criada! Suas vendas agora caem na sua conta.');
      setAberto(false);
      setForm(VAZIO);
      await carregarStatus();
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      console.error('Erro ao cadastrar recebedor no Asaas:', e);
      toast.error(msg || 'Não foi possível criar a conta de recebimento.');
    } finally {
      setSalvando(false);
    }
  };

  if (!status) {
    return (
      <div className="surface rounded-2xl p-4 flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-textMuted" />
        <span className="text-xs text-textMuted">Verificando conta de recebimento…</span>
      </div>
    );
  }

  return (
    <>
      <div className="surface rounded-2xl p-4 flex items-center gap-4 text-left">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
            status.connected
              ? 'bg-success/10 border-success/20 text-success'
              : 'bg-primary/10 border-primary/20 text-primary'
          }`}
        >
          {status.connected ? <CheckCircle2 size={20} /> : <Wallet size={20} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-sm text-textLight">Conta de recebimento</p>
          <p className="text-xs text-textMuted mt-0.5 leading-relaxed">
            {status.connected
              ? `Ativa${status.feePercent ? ` · taxa da plataforma ${status.feePercent}%` : ''}`
              : 'Cadastre seus dados para receber as vendas direto na sua conta.'}
          </p>
        </div>

        {!status.connected && (
          <Button size="sm" onClick={() => setAberto(true)}>
            Cadastrar
          </Button>
        )}
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="asaas-titulo"
        >
          <form
            onSubmit={enviar}
            className="surface rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="asaas-titulo" className="font-display font-semibold text-lg text-textLight">
                  Conta de recebimento
                </h3>
                <p className="text-xs text-textMuted mt-1 leading-relaxed">
                  Estes dados criam sua conta no Asaas, que processa os pagamentos e repassa o
                  valor das suas vendas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="text-textMuted hover:text-textLight p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <Input
              label="Nome completo / Razão social"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              error={erros.name}
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={erros.email}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="CPF / CNPJ"
                inputMode="numeric"
                value={form.cpfCnpj}
                // Máscara de CPF só até 11 dígitos; acima disso é CNPJ e segue cru.
                onChange={(e) =>
                  set('cpfCnpj', e.target.value.replace(/\D/g, '').length <= 11 ? formatCPF(e.target.value) : e.target.value)
                }
                error={erros.cpfCnpj}
              />
              <Input
                label="Celular"
                inputMode="numeric"
                value={form.mobilePhone}
                onChange={(e) => set('mobilePhone', formatPhone(e.target.value))}
                error={erros.mobilePhone}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="CEP"
                inputMode="numeric"
                value={form.postalCode}
                onChange={(e) => set('postalCode', e.target.value.replace(/\D/g, '').slice(0, 8))}
                error={erros.postalCode}
              />
              <Input
                label="Bairro"
                value={form.province}
                onChange={(e) => set('province', e.target.value)}
                error={erros.province}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Logradouro"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  error={erros.address}
                />
              </div>
              <Input
                label="Número"
                value={form.addressNumber}
                onChange={(e) => set('addressNumber', e.target.value)}
                error={erros.addressNumber}
              />
            </div>

            <Input
              label="Complemento (opcional)"
              value={form.complement}
              onChange={(e) => set('complement', e.target.value)}
            />

            <Input
              label="Faturamento mensal (R$)"
              inputMode="numeric"
              hint="Exigido pelo Asaas para abrir a conta. Uma estimativa média basta."
              value={form.incomeValue}
              onChange={(e) => set('incomeValue', e.target.value.replace(/[^\d]/g, ''))}
              error={erros.incomeValue}
            />

            <div className="flex gap-3 mt-2">
              <Button type="button" variant="secondary" fullWidth onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" fullWidth loading={salvando}>
                Criar conta
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
