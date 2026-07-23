# Chain — Plataforma de Eventos 🎟️

**Chain** é uma plataforma de descoberta, venda e validação de ingressos para eventos, festivais, casas noturnas e atléticas. Cobre o ciclo inteiro: o cliente descobre o evento no feed, paga por PIX, recebe o ingresso, e a portaria valida por QR Code.

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
Serviços Firebase usados pelo app: Authentication · Firestore · Cloud Functions · Storage · Cloud Messaging · Analytics

**Testes** — Vitest + Testing Library + jsdom, no frontend e nas functions. Regras do Firestore testadas com `@firebase/rules-unit-testing`.

**Identidade visual** — tema claro, âmbar `#FFB34D` e preto `#000000` sobre off-white `#FFFCF8`, tipografia Plus Jakarta Sans.

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
- **Código curto** — formato `CHN-XXXX-XXXX`, para digitar quando a câmera falha (o prefixo legado `ATX-` continua aceito)

O código curto é derivado do id por FNV-1a → base32 Crockford, sem campo extra no banco. Se mais de uma inscrição casar com o mesmo código, o sistema **recusa a validação** em vez de arriscar liberar a pessoa errada. Check-ins não podem ser revertidos.

---

## 🔧 Rodando localmente

**Pré-requisitos:** Node 22+, projeto Firebase próprio, credenciais do Mercado Pago (para testar pagamento).

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

O frontend só conecta nos emuladores do Firebase se o host for `localhost`/`127.0.0.1` **e** `VITE_USE_EMULATORS` for `true`.

**Testes das regras do Firestore** ficam em `tests/rules/` e exigem o emulador Firestore ativo. Estão fora da suíte padrão do Vitest e não rodam no CI.

---

## 🚢 CI e deploy

CI em `.github/workflows/ci.yml`, disparado em push e PR para `main`: build + testes do frontend e das functions. O deploy é feito na hospedagem de sua escolha — o build gera um site estático em `dist/` (SPA: configure rewrite de todas as rotas para `/index.html`).

Secret necessário no repositório: `ENV_FILE` (conteúdo completo do `.env` do frontend).

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
