# Atchei — Plataforma de Eventos 🎟️

**Atchei** é uma plataforma de descoberta, venda e validação de ingressos para eventos, festivais, casas noturnas e atléticas. Cobre o ciclo inteiro: o cliente descobre o evento no feed, paga por PIX, recebe o ingresso, e a portaria valida por QR Code.

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

**Frontend** — React 19 · Vite 8 · TypeScript · Tailwind 3 · React Router 7 · Lucide
`react-hook-form` + `zod` (formulários) · `@vis.gl/react-google-maps` · `@zxing/browser` (leitura de QR) · `react-easy-crop` · `html-to-image` · `vite-plugin-pwa`
Animações de entrada são CSS puro (`@keyframes anim-enter` em `index.css`), sem biblioteca.

**Backend** — Cloud Functions gen2 (Node 22) · `firebase-admin` · API v3 do Asaas (via `fetch`, sem SDK)
Serviços Firebase usados pelo app: Authentication · Firestore · Cloud Functions · Storage · Cloud Messaging

**Testes** — Vitest + Testing Library + jsdom, no frontend e nas functions.

**Identidade visual** — tema claro, âmbar `#FFB34D` e preto `#000000` sobre off-white `#FFFCF8`, tipografia Plus Jakarta Sans.

---

## 💳 Pagamento

Método **exclusivamente PIX**, via Asaas (API v3), com **split de pagamento**. Não há cartão.

1. O cliente escolhe os lotes e informa os dados.
2. A function `criarCobrancaPix` valida o estoque e **recalcula o preço no servidor** a partir do documento do evento — o valor enviado pelo cliente é ignorado.
3. A cobrança é criada com a chave **da plataforma**; o array `split` repassa a parte do organizador para o `walletId` dele (`PLATFORM_FEE_PERCENT` define a comissão retida). O QR Code vem numa segunda chamada.
4. O Asaas notifica o webhook. Numa transação Firestore: o pedido vira `pago`, o estoque do lote é decrementado, as inscrições são criadas e uma push é enviada.

O organizador vira recebedor cadastrando seus dados no perfil (`asaasCadastrarRecebedor` cria a subconta). Sem recebedor, a venda acontece sem split e o valor fica integralmente na plataforma.

**Garantias implementadas**
- Webhook autenticado pelo token estático `asaas-access-token`, comparado *timing-safe*, **fail-closed** — sem o token em produção, o webhook rejeita. O Asaas **não assina o payload** (não há HMAC como no Mercado Pago), então o status de pagamento é sempre **reconsultado na API** antes de emitir ingresso: um payload forjado não vira ingresso.
- Idempotência por `pedidoId`, com IDs de inscrição determinísticos — retry do Asaas não duplica ingresso.
- Estados terminais (`pago`, `estornado`, `chargeback`, `cancelado`) bloqueiam reprocessamento.
- Estorno e chargeback devolvem estoque e **deletam as inscrições** — ingresso estornado não passa na portaria.
- Venda simultânea que estoure a capacidade marca o pedido como `overbooked` e **estorna automaticamente**.
- Rate limiting transacional por operação.

---

## 🎫 Validação na portaria

O scanner aceita duas entradas:

- **QR Code** — o id completo do documento de inscrição
- **Código curto** — formato `ATX-XXXX-XXXX`, para digitar quando a câmera falha (o prefixo legado `CHN-` continua aceito)

O código curto é derivado do id por FNV-1a → base32 Crockford, sem campo extra no banco. Se mais de uma inscrição casar com o mesmo código, o sistema **recusa a validação** em vez de arriscar liberar a pessoa errada. Check-ins não podem ser revertidos.

---

## 🔧 Rodando localmente

**Pré-requisitos:** Node 22+, projeto Firebase próprio, conta Asaas (use a chave de **sandbox** para testar pagamento).

```bash
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
ASAAS_API_KEY=               # chave de sandbox para desenvolvimento
ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=         # o mesmo valor cadastrado no webhook do Asaas
PLATFORM_FEE_PERCENT=10      # comissão retida pela plataforma, em %
APP_BASE_URL=http://localhost:5173
```

> Em produção, a chave e o token do webhook vão pelo Secret Manager, não pelo `.env`
> (que é empacotado no deploy): `firebase functions:secrets:set ASAAS_API_KEY`.

> ⚠️ Sem `VITE_USE_EMULATORS=true`, o `npm run dev` fala com **produção**.

```bash
npm run dev          # Vite
npm run build        # tsc -b && vite build
npm run lint
npm run test:run     # suíte usada no CI
```

O frontend só conecta nos emuladores do Firebase se o host for `localhost`/`127.0.0.1` **e** `VITE_USE_EMULATORS` for `true`.


---

## 🚢 CI e deploy

Convenção do projeto: todo trabalho entra na `main` por Pull Request com o CI verde — nada de push direto.

1. **CI** (`.github/workflows/ci.yml`) — roda em todo PR para `main`: build + testes do frontend e das functions. Só mescle com o check "Build e Testes" verde.
2. **Deploy** (`.github/workflows/deploy.yml`) — roda no push para `main` (ou seja, a cada merge): repete os testes, builda e publica no Firebase (hosting + rules + functions) com `firebase-tools`.

Fluxo do dia a dia: `git checkout -b minha-mudanca` → commits → push → abrir PR → CI verde → merge → deploy automático.

Secrets necessários no repositório: `VITE_ENV` (conteúdo completo do `.env` do frontend) e `FIREBASE_SERVICE_ACCOUNT` (JSON da service account usada no deploy).

---

## 📁 Estrutura

```
src/
  pages/         telas (Feed, EventDetails, ValidateTickets, Admin, ...)
  components/    componentes compartilhados
  lib/           firebase, storage, ticketCode, tipos
functions/
  index.js       Cloud Functions (PIX, webhook, admin, triggers)
  asaas.js       cliente da API v3 do Asaas + cofre de recebedores
  rateLimiter.js rate limiting transacional
  scripts/       utilitários administrativos
firebase/        firestore.rules e storage.rules
docs/            documentação (identidade visual)
```

---

## 📄 Licença

Software proprietário. Todos os direitos reservados — veja [LICENSE](LICENSE).
