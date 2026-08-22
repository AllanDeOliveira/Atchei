import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import Module from 'module';
import crypto from 'crypto';

// 1. Criar as referências para os mocks (acessíveis nos testes)
const mockDocGet = vi.fn();
const mockDocSet = vi.fn();
const mockDocUpdate = vi.fn();
const mockRunTransaction = vi.fn();

const mockQuery = {
  limit: vi.fn(),
  get: vi.fn(),
};

// Coleções simuladas dinamicamente
const mockCollection = (colName) => ({
  doc: vi.fn((docId) => ({
    _path: `${colName}/${docId}`,
    get: mockDocGet,
    set: mockDocSet,
    update: mockDocUpdate,
  })),
  where: vi.fn(() => mockQuery),
});

mockQuery.limit.mockReturnValue(mockQuery);
mockQuery.get.mockResolvedValue({ empty: true, docs: [] });

const mockFirestore = {
  collection: vi.fn((colName) => mockCollection(colName)),
  runTransaction: mockRunTransaction,
};

const mockAuthUpdateUser = vi.fn();
const mockAuthSetCustomClaims = vi.fn();

// Mocks das chamadas de rede ao Asaas. `calcSplit` NÃO é mockada — a matemática do
// dinheiro é exercitada de verdade através destes testes.
const mockAsaasCliente = vi.fn();
const mockAsaasCriarCobranca = vi.fn();
const mockAsaasQrCode = vi.fn();
const mockAsaasConsultar = vi.fn();
const mockAsaasEstornar = vi.fn();
const mockAsaasGetRecebedor = vi.fn();

// Mock do firebase-admin
const mockAdmin = {
  initializeApp: vi.fn(),
  firestore: vi.fn(() => mockFirestore),
  auth: vi.fn(() => ({
    updateUser: mockAuthUpdateUser,
    setCustomUserClaims: mockAuthSetCustomClaims,
  })),
  FieldValue: {
    serverTimestamp: vi.fn(() => 'mock-server-timestamp'),
    increment: vi.fn((val) => ({ type: 'increment', value: val })),
  },
};

// 2. Interceptar Module.prototype.require para forçar o carregamento dos mocks no index.js
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'firebase-admin') {
    return mockAdmin;
  }
  if (id === './asaas') {
    // Módulo real com só as chamadas de rede substituídas: o cofre e, principalmente,
    // `calcSplit` continuam sendo os de produção.
    const real = originalRequire.call(this, './asaas');
    return {
      ...real,
      buscarOuCriarCliente: mockAsaasCliente,
      criarCobrancaPix: mockAsaasCriarCobranca,
      obterQrCodePix: mockAsaasQrCode,
      consultarCobranca: mockAsaasConsultar,
      estornarCobranca: mockAsaasEstornar,
      getRecebedor: mockAsaasGetRecebedor,
    };
  }
  if (id === './rateLimiter') {
    return {
      checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
      LIMITS: {
        CRIAR_COBRANCA: { max: 5, windowSec: 60 },
        CRIAR_COBRANCA_HORA: { max: 20, windowSec: 3600 },
        ADMIN_RESET: { max: 3, windowSec: 300 },
        WEBHOOK: { max: 60, windowSec: 60 },
        RECUPERAR_INGRESSO: { max: 10, windowSec: 60 },
      },
    };
  }
  return originalRequire.apply(this, arguments);
};

// 3. Inicializar variáveis de ambiente e importar index.js
process.env.ASAAS_API_KEY = 'mock-asaas-key';
const requireLocal = createRequire(import.meta.url);
const myFunctions = requireLocal('./index.js');
const { ADMIN_EMAILS } = requireLocal('./adminEmails.js');
const fft = requireLocal('firebase-functions-test')();

describe('Cloud Functions Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks NÃO esvazia as filas de mockResolvedValueOnce. Sem o reset explícito,
    // um teste que falha no meio deixa respostas enfileiradas e derruba o teste seguinte
    // por um motivo que nada tem a ver com ele.
    mockDocGet.mockReset();
    mockDocSet.mockReset();
    mockDocUpdate.mockReset();
    mockRunTransaction.mockReset();
    mockQuery.get.mockReset();
    mockAsaasCliente.mockReset();
    mockAsaasCriarCobranca.mockReset();
    mockAsaasQrCode.mockReset();
    mockAsaasConsultar.mockReset();
    mockAsaasEstornar.mockReset();
    mockAsaasGetRecebedor.mockReset();

    mockQuery.get.mockResolvedValue({ empty: true, docs: [] });
    mockQuery.limit.mockReturnValue(mockQuery);
    // Padrões neutros: organizador sem recebedor e Asaas respondendo o mínimo viável.
    mockAsaasGetRecebedor.mockResolvedValue(null);
    mockAsaasCliente.mockResolvedValue('cus_mock');
    mockAsaasCriarCobranca.mockResolvedValue({ id: 'pay_mock' });
    mockAsaasQrCode.mockResolvedValue({ qr_code: 'copia-e-cola', qr_code_base64: 'base64' });
  });

  describe('criarCobrancaPix', () => {
    const CPF_VALIDO = '52998224725';

    const pedidoBase = (over = {}) => ({
      valor: 50,
      cpf: CPF_VALIDO,
      email: 'comprador@teste.com',
      clienteNome: 'Fulano de Tal',
      clienteTelefone: '11988887777',
      pedidoId: 'ped-123',
      eventId: 'evt-123',
      itensSelecionados: [{ id: 'lote-1', quantity: 1, price: 50, name: 'Lote VIP' }],
      ...over,
    });

    // Leituras na ordem em que criarCobrancaPix as faz: evento -> guarda do pedido.
    const filaPadrao = (eventoOver = {}) => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          creatorId: 'org-1',
          tickets: [{ id: 'lote-1', name: 'Lote VIP', capacity: 10, sold: 2, price: 50 }],
          ...eventoOver,
        }),
      });
      mockDocGet.mockResolvedValueOnce({ exists: false });
    };

    it('deve falhar se dados incompletos forem fornecidos', async () => {
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
      await expect(wrapped({ data: { valor: null } })).rejects.toThrow('Dados incompletos para gerar o Pix.');
    });

    // Kill switch do Pix. Esconder o botão no front não basta: o endpoint é público
    // e precisa recusar sozinho enquanto as vendas estiverem em stand-by.
    it('recusa cobranca nova quando o Pix esta em stand-by', async () => {
      const anterior = process.env.PIX_ENABLED;
      process.env.PIX_ENABLED = 'false';
      try {
        const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
        filaPadrao();

        await expect(wrapped({ data: pedidoBase(), auth: { uid: 'user-1' } }))
          .rejects.toThrow('As vendas por Pix estão temporariamente indisponíveis.');
        expect(mockAsaasCriarCobranca).not.toHaveBeenCalled();
      } finally {
        if (anterior === undefined) delete process.env.PIX_ENABLED;
        else process.env.PIX_ENABLED = anterior;
      }
    });

    // O valor do cliente nunca pode virar a cobrança: sem itens e sem preço no
    // evento não há origem confiável, então o pedido é recusado.
    it('recusa quando nao ha itens nem preco configurado no evento', async () => {
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
      filaPadrao({ pixTicketPrice: '' });

      await expect(wrapped({ data: pedidoBase({ itensSelecionados: [], valor: 0.01 }), auth: { uid: 'user-1' } }))
        .rejects.toThrow('Este evento não tem preço de ingresso configurado.');
      expect(mockAsaasCriarCobranca).not.toHaveBeenCalled();
    });

    it('recusa compra sem autenticacao', async () => {
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
      await expect(wrapped({ data: pedidoBase() }))
        .rejects.toThrow('Faça login para comprar ingressos.');
      expect(mockAsaasCriarCobranca).not.toHaveBeenCalled();
    });

    it('recusa CPF/CNPJ invalido antes de falar com o Asaas', async () => {
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
      filaPadrao();

      await expect(wrapped({ data: pedidoBase({ cpf: '123' }), auth: { uid: 'user-1' } }))
        .rejects.toThrow('Informe um CPF ou CNPJ válido para gerar o Pix.');
      expect(mockAsaasCriarCobranca).not.toHaveBeenCalled();
    });

    it('deve criar cobranca pix com sucesso se houver estoque', async () => {
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
      filaPadrao();
      mockAsaasCriarCobranca.mockResolvedValueOnce({ id: 'pay_abc' });
      mockAsaasQrCode.mockResolvedValueOnce({ qr_code: 'copia-e-cola', qr_code_base64: 'base64-img' });

      const result = await wrapped({ data: pedidoBase(), auth: { uid: 'user-1' } });

      const [corpo] = mockAsaasCriarCobranca.mock.calls[0];
      expect(corpo.billingType).toBeUndefined(); // billingType é fixado dentro de asaas.js
      expect(corpo.value).toBe(50);
      expect(corpo.externalReference).toBe('ped-123');

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ped-123', valor: 50, status: 'pendente', asaasPaymentId: 'pay_abc' }),
        expect.anything()
      );
      // Contrato com o frontend inalterado.
      expect(result).toEqual({ id: 'pay_abc', qr_code: 'copia-e-cola', qr_code_base64: 'base64-img' });
    });

    it('deve falhar se a quantidade solicitada exceder o estoque', async () => {
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          creatorId: 'org-1',
          tickets: [{ id: 'lote-1', name: 'Lote VIP', capacity: 10, price: 50 }],
          // Estoque vem de soldByTicket (escrito só pelo backend), não do array de tickets.
          soldByTicket: { 'lote-1': 10 },
        }),
      });

      await expect(wrapped({ data: pedidoBase(), auth: { uid: 'user-1' } }))
        .rejects.toThrow('Desculpe, o ingresso "Lote VIP" esgotou ou não possui a quantidade solicitada disponível.');
    });

    it('ignora o preco enviado pelo cliente e usa o do evento', async () => {
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
      filaPadrao();

      // Cliente tenta pagar R$ 1 por um ingresso de R$ 50.
      await wrapped({ data: pedidoBase({ valor: 1, itensSelecionados: [{ id: 'lote-1', quantity: 1, price: 1 }] }), auth: { uid: 'user-1' } });

      const [corpo] = mockAsaasCriarCobranca.mock.calls[0];
      expect(corpo.value).toBe(50);
    });

    // ─── Split ───
    it('reparte o valor com o organizador cadastrado e retem a comissao', async () => {
      const feeOriginal = process.env.PLATFORM_FEE_PERCENT;
      process.env.PLATFORM_FEE_PERCENT = '10';
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);

      mockAsaasGetRecebedor.mockResolvedValueOnce({ walletId: 'wal_org1' });
      filaPadrao();
      mockAsaasCriarCobranca.mockResolvedValueOnce({ id: 'pay_split' });

      await wrapped({ data: pedidoBase({ pedidoId: 'ped-split' }), auth: { uid: 'user-1' } });

      // Comissão de 10% => 90% do líquido vai para a carteira do organizador.
      // Percentual, não valor fixo: fixedValue sobre o bruto estoura o teto do netValue.
      const [corpo] = mockAsaasCriarCobranca.mock.calls[0];
      expect(corpo.split).toEqual([{ walletId: 'wal_org1', percentualValue: 90 }]);

      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          split: true,
          sellerCreatorId: 'org-1',
          sellerWalletId: 'wal_org1',
          splitPercentualOrganizador: 90,
          applicationFee: 5,
          valorLiquidoOrganizador: 45,
        }),
        expect.anything()
      );

      process.env.PLATFORM_FEE_PERCENT = feeOriginal;
    });

    it('sem recebedor cadastrado, cobra sem split', async () => {
      const feeOriginal = process.env.PLATFORM_FEE_PERCENT;
      process.env.PLATFORM_FEE_PERCENT = '10';
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);

      mockAsaasGetRecebedor.mockResolvedValueOnce(null);
      filaPadrao();

      await wrapped({ data: pedidoBase({ pedidoId: 'ped-legado' }), auth: { uid: 'user-1' } });

      const [corpo] = mockAsaasCriarCobranca.mock.calls[0];
      expect(corpo.split).toBeUndefined();
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({ split: false, applicationFee: 0 }),
        expect.anything()
      );

      process.env.PLATFORM_FEE_PERCENT = feeOriginal;
    });

    it('nao regera cobranca para pedido ja pago', async () => {
      const wrapped = fft.wrap(myFunctions.criarCobrancaPix);
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ creatorId: 'org-1', tickets: [{ id: 'lote-1', name: 'Lote VIP', capacity: 10, sold: 0, price: 50 }] }),
      });
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ status: 'pago' }) });

      await expect(wrapped({ data: pedidoBase(), auth: { uid: 'user-1' } })).rejects.toThrow('Este pedido já foi processado.');
      expect(mockAsaasCriarCobranca).not.toHaveBeenCalled();
    });
  });

  describe('webhookAsaas', () => {
    const TOKEN = 'token-webhook-teste';

    // Captura a resposta do handler (que roda dentro do callback do cors).
    const chamar = async (req) => {
      let resolveSend;
      const sendPromise = new Promise((resolve) => { resolveSend = resolve; });
      // O CORS nativo do onRequest v2 registra listener no response, então o duplo
      // precisa das APIs de EventEmitter além das de escrita.
      const res = {
        set: vi.fn(),
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        removeHeader: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        emit: vi.fn(),
        removeListener: vi.fn(),
        end: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockImplementation((msg) => { resolveSend(msg); }),
      };
      myFunctions.webhookAsaas(req, res);
      await sendPromise;
      return res;
    };

    const req = (over = {}) => ({
      query: {},
      body: { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } },
      headers: { 'asaas-access-token': TOKEN },
      ...over,
    });

    let tokenOriginal;
    beforeEach(() => {
      tokenOriginal = process.env.ASAAS_WEBHOOK_TOKEN;
      process.env.ASAAS_WEBHOOK_TOKEN = TOKEN;
    });

    const restaurar = () => {
      if (tokenOriginal) process.env.ASAAS_WEBHOOK_TOKEN = tokenOriginal;
      else delete process.env.ASAAS_WEBHOOK_TOKEN;
    };

    it('rejeita quando o token do webhook nao confere', async () => {
      const res = await chamar(req({ headers: { 'asaas-access-token': 'errado' } }));
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockAsaasConsultar).not.toHaveBeenCalled();
      restaurar();
    });

    it('rejeita quando o header do token esta ausente', async () => {
      const res = await chamar(req({ headers: {} }));
      expect(res.status).toHaveBeenCalledWith(401);
      restaurar();
    });

    it('rejeita em producao se o token nao estiver configurado (fail-closed)', async () => {
      delete process.env.ASAAS_WEBHOOK_TOKEN;
      const res = await chamar(req());
      expect(res.status).toHaveBeenCalledWith(500);
      restaurar();
    });

    it('devolve 400 sem id de pagamento', async () => {
      const res = await chamar(req({ body: { event: 'PAYMENT_RECEIVED', payment: {} } }));
      expect(res.status).toHaveBeenCalledWith(400);
      restaurar();
    });

    // O ponto central: o status vem da API, não do corpo da requisição.
    it('ignora um corpo que se diz pago quando a API do Asaas diz PENDING', async () => {
      mockAsaasConsultar.mockResolvedValueOnce({ id: 'pay_1', status: 'PENDING', externalReference: 'ped-1' });

      const res = await chamar(req());

      expect(mockAsaasConsultar).toHaveBeenCalledWith('pay_1');
      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Evento ignorado.');
      restaurar();
    });

    it('processa o pagamento confirmado e emite o ingresso', async () => {
      mockAsaasConsultar.mockResolvedValueOnce({ id: 'pay_1', status: 'RECEIVED', externalReference: 'ped-1' });
      // Pedido localizado por externalReference.
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        id: 'ped-1',
        data: () => ({ status: 'pendente', eventId: 'evt-1', userId: 'u1', itensComprados: [] }),
      });

      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: 'pendente', eventId: 'evt-1', userId: 'u1', itensComprados: [] }),
        }),
        update: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      };
      mockRunTransaction.mockImplementation(async (cb) => cb(mockTx));

      const res = await chamar(req());

      expect(mockRunTransaction).toHaveBeenCalled();
      expect(mockTx.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'pago' })
      );
      // Inscrição criada com id determinístico (idempotência preservada).
      expect(mockTx.set).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      restaurar();
    });

    it('trata cobranca removida no Asaas (404) como cancelamento', async () => {
      const erro404 = new Error('not found');
      erro404.status = 404;
      mockAsaasConsultar.mockRejectedValueOnce(erro404);
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        id: 'ped-1',
        data: () => ({ status: 'pendente', eventId: 'evt-1', userId: 'u1', itensComprados: [] }),
      });

      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: 'pendente', eventId: 'evt-1', userId: 'u1', itensComprados: [] }),
        }),
        update: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      };
      mockRunTransaction.mockImplementation(async (cb) => cb(mockTx));

      const res = await chamar(req({ body: { event: 'PAYMENT_DELETED', payment: { id: 'pay_1', externalReference: 'ped-1' } } }));

      expect(mockTx.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'cancelado' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      restaurar();
    });
  });

  describe('recuperarMeusIngressos', () => {
    const regDoc = (over = {}) => ({
      id: 'reg-1',
      data: () => ({
        eventId: 'evt-1',
        userEmailLower: 'buyer@example.com',
        userName: 'Fulano',
        paymentStatus: 'Pago',
        checkedIn: false,
        timestamp: '2026-01-01T00:00:00.000Z',
        ...over,
      }),
    });

    const authed = (over = {}) => ({
      uid: 'recovery-uid',
      token: { email: 'Buyer@Example.com', email_verified: true, ...over },
    });

    it('rejeita quando nao ha sessao (sem link magico confirmado)', async () => {
      const wrapped = fft.wrap(myFunctions.recuperarMeusIngressos);
      await expect(wrapped({ data: {}, auth: null }))
        .rejects.toThrow('Confirme o link enviado ao seu e-mail para acessar os ingressos.');
      expect(mockQuery.get).not.toHaveBeenCalled();
    });

    it('rejeita quando o e-mail do token nao esta verificado', async () => {
      const wrapped = fft.wrap(myFunctions.recuperarMeusIngressos);
      await expect(wrapped({ data: {}, auth: authed({ email_verified: false }) }))
        .rejects.toThrow('Confirme o link enviado ao seu e-mail para acessar os ingressos.');
      expect(mockQuery.get).not.toHaveBeenCalled();
    });

    it('busca pelo e-mail VERIFICADO do token (normalizado), nao por dado do cliente', async () => {
      let capturedField, capturedValue;
      const registrationsCollection = {
        where: vi.fn((field, _op, value) => { capturedField = field; capturedValue = value; return mockQuery; }),
        doc: vi.fn(),
      };
      mockFirestore.collection.mockImplementationOnce((name) =>
        name === 'registrations' ? registrationsCollection : mockCollection(name)
      );
      mockQuery.get.mockResolvedValueOnce({ docs: [regDoc()] });
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ title: 'Show', date: '2026-08-01', time: '20:00', location: 'Arena', address: 'Rua X' }),
      });

      const wrapped = fft.wrap(myFunctions.recuperarMeusIngressos);
      // O cliente tenta injetar o e-mail de uma vitima; deve ser IGNORADO.
      const result = await wrapped({ data: { email: 'vitima@example.com' }, auth: authed() });

      expect(capturedField).toBe('userEmailLower');
      expect(capturedValue).toBe('buyer@example.com'); // do token, minusculo — nao 'vitima@...'
      expect(result.ingressos).toHaveLength(1);
      expect(result.ingressos[0].event.title).toBe('Show');
    });

    it('ignora ingressos de teste', async () => {
      mockQuery.get.mockResolvedValueOnce({ docs: [regDoc({ isTeste: true })] });
      const wrapped = fft.wrap(myFunctions.recuperarMeusIngressos);
      const result = await wrapped({ data: {}, auth: authed() });
      expect(result).toEqual({ ingressos: [] });
    });
  });
});
