# Atchêi — Plataforma de Eventos 🎟️

**Atchêi** é uma plataforma de descoberta, venda e validação de ingressos para eventos, festivais, casas noturnas e atléticas em **Cáceres-MT**. Cobre o ciclo inteiro: o cliente descobre o evento no feed, paga por PIX, recebe o ingresso, e a portaria valida por QR Code.

👉 **[atche-sistemas.web.app](https://atche-sistemas.web.app/)**

---

> [!IMPORTANT]
> **AVISO ACADÊMICO:** Este projeto é um trabalho acadêmico em desenvolvimento.
> Por estar em um repositório público para fins de avaliação e demonstração, pedimos gentilmente que **não realizem alterações, não enviem Pull Requests não solicitados e não "baguncem" o código ou a estrutura**, pois ele está sendo utilizado para entrega oficial. Agradecemos a compreensão! 🙏

---

## 🤝 Para Estabelecimentos e Organizadores

Você é proprietário de uma casa noturna, organizador de festivais ou líder de atlética? O **Atchêi** foi desenhado para elevar o nível da sua marca.

- **Visibilidade Premium** — seu evento em destaque num feed pensado para gerar desejo.
- **Painel de Gestão** — controle sobre seus eventos, lotes, preços e descrições.
- **Venda por PIX** — cobrança gerada na hora, com baixa automática e controle de estoque por lote.
- **Portaria digital** — validação por QR Code ou código curto, sem papel e sem lista impressa.
- **Painel financeiro** — acompanhamento das vendas dos seus próprios eventos.
- **Localização Inteligente** — integração com Google Maps para direcionar seu público.

### 📩 Tem interesse?

Estamos abertos a novas parcerias e expansões da plataforma:

- **Instagram**: [@theocarvalho.dev](https://instagram.com/theo_carvalho.09)
- **WhatsApp**: [Conversar com Theo](https://wa.me/5565996097252)
- **GitHub**: [TheoCarvalhoDEV](https://github.com/TheoCarvalhoDEV)

---

## ✨ Funcionalidades

**Para o público**
- Feed paginado de eventos futuros, com busca e filtros
- Compra de ingresso por **PIX** — funciona com ou sem conta
- Confirmação de **presença gratuita** em eventos que permitem
- Ingresso exportável como imagem
- Recuperação de ingressos via login com Google, sem precisar de cadastro prévio
- **PWA instalável** com notificações push

**Para parceiros**
- Criação e edição dos próprios eventos, com múltiplos lotes
- Upload de imagens com recorte
- Painel financeiro dos próprios eventos
- Inscrições manuais (cortesia, dinheiro, PIX manual)
- Scanner de portaria em tela cheia, com troca de câmera e feedback por vibração

**Para admin**
- Gestão irrestrita de eventos, parceiros e inscrições
- Criação de parceiros com senha temporária e troca obrigatória no primeiro acesso
- Concessão de privilégio de admin via *custom claim*
- Geração de ingressos de teste sem afetar estoque

---

## 👥 Papéis

| Papel | O que pode fazer |
|---|---|
| **Visitante** | Ver feed, busca e detalhes; confirmar presença gratuita; comprar por PIX; recuperar ingressos via Google |
| **Cliente** | Tudo acima + perfil, meus ingressos e notificações push |
| **Parceiro** (`atletica` / `estabelecimento`) | Criar, editar e excluir **os próprios** eventos; painel financeiro; validar ingressos dos próprios eventos; inscrições manuais |
| **Admin** | Acesso irrestrito, incluindo CRUD de parceiros e concessão de claims |

Autorização de admin é **100% via custom claim** do Firebase Auth — não existe fallback por e-mail. O **registro público de contas está desativado**: parceiros são criados pelo admin.

---

## 🛠️ Stack

**Frontend** — React 19 · Vite 8 · TypeScript · Tailwind 3 · React Router 7 · GSAP · Lucide
`react-hook-form` + `zod` (formulários) · `@vis.gl/react-google-maps` · `@zxing/browser` (leitura de QR) · `react-easy-crop` · `html-to-image` · `vite-plugin-pwa`

**Backend** — Cloud Functions gen2 (Node 22) · `firebase-admin` · SDK do Mercado Pago

**Firebase** — Authentication · Firestore · Cloud Functions · Hosting · Storage · Cloud Messaging · Analytics
Projeto: `atche-sistemas`

**Testes** — Vitest + Testing Library + jsdom, no frontend e nas functions. Regras do Firestore testadas com `@firebase/rules-unit-testing`.

**Identidade visual** — tema claro, vinho `#6B1D1D` sobre bege `#F5EDE3`, tipografia Plus Jakarta Sans.

---

## 💳 Pagamento

Método **exclusivamente PIX**, via Mercado Pago. Não há cartão.

1. O cliente escolhe os lotes e informa os dados.
2. A function `criarCobrancaPix` valida o estoque e **recalcula o preço no servidor** a partir do documento do evento — o valor enviado pelo cliente é ignorado.
3. Retorna o QR Code copia-e-cola e a imagem.
4. O Mercado Pago notifica o webhook. Numa transação Firestore: o pedido vira `pago`, o estoque do lote é decrementado, as inscrições são criadas e uma push é enviada.

**Garantias implementadas**
- Assinatura HMAC-SHA256 do webhook validada com comparação *timing-safe*, **fail-closed** — sem o segredo em produção, o webhook rejeita.
- Idempotência por `pedidoId`, com IDs de inscrição determinísticos — retry do Mercado Pago não duplica ingresso.
- Estados terminais (`pago`, `estornado`, `chargeback`, `cancelado`) bloqueiam reprocessamento.
- Estorno e chargeback devolvem estoque e **deletam as inscrições** — ingresso estornado não passa na portaria.
- Venda simultânea que estoure a capacidade marca o pedido como `overbooked` e **reembolsa automaticamente**.
- Rate limiting transacional por operação.

---

## 🎫 Validação na portaria

O scanner aceita duas entradas:

- **QR Code** — o id completo do documento de inscrição
- **Código curto** — formato `ATX-XXXX-XXXX`, para digitar quando a câmera falha

O código curto é derivado do id por FNV-1a → base32 Crockford, sem campo extra no banco. Se mais de uma inscrição casar com o mesmo código, o sistema **recusa a validação** em vez de arriscar liberar a pessoa errada. Check-ins não podem ser revertidos.

---

## 🔧 Rodando localmente

**Pré-requisitos:** Node 22+, conta Firebase, credenciais do Mercado Pago (para testar pagamento).

```bash
git clone https://github.com/TheoCarvalhoDEV/athc-.git
cd athc-
npm install
```

Crie um `.env` na raiz (veja `.env.example`):

```env
VITE_GOOGLE_MAPS_API_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_VAPID_KEY=     # opcional — sem ela, push fica desativado
VITE_USE_EMULATORS=          # 'true' para falar com os emuladores
```

E um `functions/.env` para o runtime das Cloud Functions:

```env
MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=
```

> ⚠️ Sem `VITE_USE_EMULATORS=true`, o `npm run dev` fala com **produção**.

```bash
npm run dev          # Vite
npm run build        # tsc -b && vite build
npm run lint
npm run test:run     # suíte usada no CI
```

**Emuladores** — Functions em `:5001`, Firestore em `:8080`:

```bash
cd functions && npm run serve
```

O frontend só conecta nos emuladores se o host for `localhost`/`127.0.0.1` **e** `VITE_USE_EMULATORS` for `true`.

**Testes das regras do Firestore** ficam em `tests/rules/` e exigem o emulador Firestore ativo. Estão fora da suíte padrão do Vitest e não rodam no CI.

---

## 🚢 Deploy

CI em `.github/workflows/ci.yml`, disparado em push e PR para `master`.

- **`build-test`** — build, testes do frontend e testes das functions
- **`deploy`** — só em push para `master`; publica hosting, functions, regras do Firestore e do Storage

Secrets necessários no repositório:

| Secret | Uso |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | conta de serviço com permissão de deploy |
| `MP_ACCESS_TOKEN` | token do Mercado Pago (runtime) |
| `MP_WEBHOOK_SECRET` | segredo de assinatura do webhook |
| `ENV_FILE` | conteúdo completo do `.env` do frontend |

> O job de deploy **recria o `functions/.env`** a partir dos secrets. Isso não é opcional: o deploy gen2 define o ambiente do Cloud Run a partir desse arquivo, e sem ele o `MP_WEBHOOK_SECRET` sumiria — o webhook passaria a rejeitar todas as notificações.

Sem `FIREBASE_SERVICE_ACCOUNT` configurado, o deploy é pulado com job verde (caso de fork ou PR externo).

---

## 📁 Estrutura

```
src/
  pages/         telas (Feed, EventDetails, ValidateTickets, Admin, ...)
  components/    componentes compartilhados
  lib/           firebase, storage, ticketCode, tipos
functions/
  index.js       Cloud Functions (PIX, webhook, admin, triggers)
  rateLimiter.js rate limiting transacional
  scripts/       utilitários administrativos
tests/rules/     testes das security rules
```

---

## 📄 Licença

Software proprietário. Todos os direitos reservados — veja [LICENSE](LICENSE).

O código está visível para fins de avaliação acadêmica e demonstração. Isso **não** concede permissão de uso, cópia, modificação ou redistribuição.

---

*Desenvolvido por Theo Carvalho e Allan de Oliveira.*
#   C h a i n  
 