# Atchei — Plataforma de Eventos 🎟️

**Atchei** é uma plataforma para criar e descobrir eventos de qualquer tipo — de festas, shows e festivais a um racha de vôlei, um encontro cultural ou um evento gastronômico. Qualquer pessoa logada cria um evento em minutos e escolhe como ele funciona: **presença gratuita** (só juntar gente) e/ou **venda por WhatsApp** (contato direto com promoters) — os modos são combináveis. A presença confirmada é um RSVP social: conta no evento e entra na lista de inscritos, mas **não emite ingresso**. Para quem vende, o ciclo se fecha na portaria: o ingresso é validado por QR Code.

---

## ✨ Funcionalidades

**Para o público**
- Feed paginado de eventos futuros, com busca e filtro por categoria (Festa, Universitário, Show, Esporte, Gastronomia, Cultural, Outros)
- Confirmação de **presença gratuita** em eventos que permitem — RSVP em 1 toque, sem emitir ingresso
- Ingresso exportável como imagem
- Recuperação de ingressos via login com Google, sem precisar de cadastro prévio
- **PWA instalável** com notificações push

**Para organizadores** (qualquer conta logada)
- Criação e edição dos próprios eventos, escolhendo os modos combináveis: presença gratuita e venda por WhatsApp (promoters)
- Upload de imagens com recorte
- Painel financeiro dos próprios eventos
- Inscrições manuais (cortesia, dinheiro, PIX manual)
- Scanner de portaria em tela cheia, com troca de câmera e feedback por vibração

**Para admin**
- Gestão irrestrita de eventos, perfis e inscrições
- Criação de perfis com senha temporária e troca obrigatória no primeiro acesso
- Concessão de privilégio de admin via *custom claim*
- Geração de ingressos de teste sem afetar estoque

---

## 👥 Papéis

| Papel | O que pode fazer |
|---|---|
| **Visitante** | Ver feed, busca e detalhes; confirmar presença gratuita; recuperar ingressos via Google |
| **Pessoal** (`user`) | Tudo acima + perfil, meus ingressos, notificações push; criar, editar e excluir **os próprios** eventos; validar ingressos dos próprios eventos; inscrições manuais; painel financeiro |
| **Profissional** (`profissional`) | Tudo acima + aparece no diretório público de organizadores da busca |
| **Admin** | Acesso irrestrito, incluindo CRUD de perfis e concessão de claims |

Os tipos legados `atletica` e `estabelecimento` foram fundidos em `profissional` (documentos antigos continuam valendo como profissionais). O **registro público de contas está aberto** (tipos `user` e `profissional`), com exigência de **18+** validada também nas security rules — o admin ainda pode criar perfis manualmente com senha temporária. Autorização de admin é **100% via custom claim** do Firebase Auth — não existe fallback por e-mail.

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

Não há pagamento dentro da plataforma no momento. A venda de ingressos acontece por **WhatsApp**, em contato direto com os promoters cadastrados no evento; o registro do pagamento (dinheiro, PIX manual, cortesia) é feito pelo organizador via inscrição manual.

> Existe um fluxo completo de venda integrada por PIX (Asaas v3, com split) implementado no código, mas ele está **pausado** por kill switch duplo: `PIX_ENABLED = false` em `src/lib/flags.ts` (esconde a interface) e `PIX_ENABLED=false` no ambiente das functions (bloqueia `criarCobrancaPix` no servidor). Os dois precisam ser religados juntos para reativar.

---

## 🎫 Validação na portaria

O scanner aceita duas entradas:

- **QR Code** — o id completo do documento de inscrição
- **Código curto** — formato `ATX-XXXX-XXXX`, para digitar quando a câmera falha (o prefixo legado `CHN-` continua aceito)

O código curto é derivado do id por FNV-1a → base32 Crockford, sem campo extra no banco. Se mais de uma inscrição casar com o mesmo código, o sistema **recusa a validação** em vez de arriscar liberar a pessoa errada. Check-ins não podem ser revertidos.

Só ingresso de verdade passa: intenção de compra ainda não confirmada pelo vendedor e **confirmação de presença gratuita** (que não é ingresso) são recusadas pelo scanner.

---

## 🔧 Rodando localmente

**Pré-requisitos:** Node 22+, projeto Firebase próprio. Conta Asaas só é necessária para mexer no fluxo de PIX, que está pausado (use a chave de **sandbox**).

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
APP_BASE_URL=http://localhost:5173
RESEND_API_KEY=              # e-mail transacional (redefinição de senha)
EMAIL_FROM=                  # remetente verificado no Resend
PIX_ENABLED=false            # kill switch do fluxo de PIX (pausado)

# Só para mexer no fluxo de PIX (pausado):
ASAAS_API_KEY=               # chave de sandbox para desenvolvimento
ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=         # o mesmo valor cadastrado no webhook do Asaas
PLATFORM_FEE_PERCENT=10      # comissão retida pela plataforma, em %
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
