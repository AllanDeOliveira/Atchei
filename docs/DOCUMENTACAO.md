# Atchei — Documentação Técnica

Documento de referência do projeto: o que ele é, como está construído, como os dados se organizam, como a segurança funciona, como se roda, testa, faz deploy e opera. Complementa o [README](../README.md) (visão de produto e início rápido) e a [identidade visual](identidade-visual.md).

Última revisão: 2026-09-17.

> **Chegou agora no projeto?** Ordem sugerida: [README](../README.md) (10 min) → §1, §3 e §6 daqui (o domínio, o desenho e os dados) → [CLAUDE.md](../CLAUDE.md) (checks e decisões fechadas, mesmo que você não use o Claude Code) → §11 quando precisar operar. O histórico de decisões está em §13. Peça ao Allan acesso ao projeto Firebase `atchei` e ao repositório; o `.env` não está no git (veja o README para as variáveis).

## Sumário

1. [Visão geral e domínio](#1-visão-geral-e-domínio)
2. [Linguagens, frameworks e ferramentas](#2-linguagens-frameworks-e-ferramentas)
3. [Arquitetura geral](#3-arquitetura-geral)
4. [Frontend](#4-frontend)
5. [Backend (Cloud Functions)](#5-backend-cloud-functions)
6. [Modelo de dados (Firestore)](#6-modelo-de-dados-firestore)
7. [Segurança](#7-segurança)
8. [Ambientes e configuração](#8-ambientes-e-configuração)
9. [Testes](#9-testes)
10. [CI/CD](#10-cicd)
11. [Operações (runbooks)](#11-operações-runbooks)
12. [Convenções de trabalho](#12-convenções-de-trabalho)
13. [Decisões e histórico](#13-decisões-e-histórico)

---

## 1. Visão geral e domínio

O Atchei é um **PWA** (Progressive Web App) de descoberta e organização de eventos, servido em **https://atchei.app.br**. O núcleo do domínio tem três entidades: **perfil** (a conta), **evento** e **inscrição** (o vínculo de uma pessoa com um evento).

### Papéis

| Papel | Como é determinado | O que faz |
|---|---|---|
| Visitante | não logado | feed, busca, página de evento, diretório de profissionais |
| Pessoal (`user`) | perfil com `type: 'user'` | tudo acima + presença gratuita, intenção de compra, ingressos, push, criar/gerir os próprios eventos |
| Profissional (`profissional`) | perfil com `type: 'profissional'` (legados `atletica`/`estabelecimento` valem como profissional) | tudo acima + aparece no diretório público |
| Admin | **custom claim** `admin: true` no token (backend) **e** perfil com `type: 'admin'` (interface) | acesso irrestrito, painel de controle, gestão de parceiros |

### Modos de participação em um evento

- **Presença gratuita** (`hasPresence`): RSVP social em 1 toque. Cria uma inscrição com `paymentStatus` `'Gratuito'`/nulo, conta em `registrationCount`, **não é ingresso** (a portaria recusa).
- **Venda por WhatsApp** (`hasTickets`): o comprador clica em "Comprar via WhatsApp", entra na lista do vendedor como `'Aguardando pagamento'` e a conversa acontece fora do app. O organizador confirma (`'Pago (WhatsApp)'`) e só então a inscrição vira ingresso válido. Os dois modos são combináveis.
- **Inscrição manual** pelo organizador (cortesia, dinheiro, PIX manual): qualquer `paymentStatus`, criada direto pelo dono do evento ou admin.
- **Ingresso de teste** (admin): inscrição com `isTeste: true`, fora de qualquer contagem, para exercitar a portaria.

### Portaria

O scanner (`/validar/:eventId`) lê o QR Code (id do documento de inscrição) ou o **código curto** `ATX-XXXX-XXXX`, derivado do id por FNV-1a → base32 Crockford (`src/lib/ticketCode.ts`), sem campo extra no banco. Colisão de código curto recusa a validação. O check-in grava `checkedIn`, `checkedInAt` e `checkedInBy` e **não pode ser revertido** (regra do Firestore).

---

## 2. Linguagens, frameworks e ferramentas

| Camada | Tecnologia | Versão | Uso |
|---|---|---|---|
| Linguagem (front) | TypeScript | ~6.0 | todo o `src/` |
| Linguagem (back) | JavaScript (CommonJS) | Node 22 | `functions/` |
| UI | React | 19 | componentes funcionais + hooks |
| Build/dev server | Vite | 8 | `npm run dev` / `npm run build` (`tsc -b && vite build`) |
| Roteamento | React Router | 7 | `BrowserRouter`, rotas em `src/App.tsx` |
| Estilo | Tailwind CSS 3 + PostCSS/Autoprefixer | 3.4 | tema em `tailwind.config.js`; animações em CSS puro (`src/index.css`) |
| Ícones | lucide-react | 1.x | |
| Formulários | nenhuma biblioteca | — | `useState` + validação em código (`src/lib/eventoForm.ts` no evento; as demais telas validam na mão) |
| Mapas | @vis.gl/react-google-maps + Maps Embed API | 1.x | Places no cadastro de evento; iframe de embed na página do evento |
| QR Code | @zxing/browser (+ @zxing/library como peer) | 0.2 | leitura na portaria |
| Imagens | react-easy-crop, html-to-image, `src/lib/imageUtils.ts` | | recorte da capa, exportar ingresso, compressão client-side |
| Toasts | react-hot-toast | 2 | |
| PWA | vite-plugin-pwa (Workbox) | 1.3 | service worker `autoUpdate`, manifest |
| Backend | Firebase Cloud Functions gen2 (`firebase-functions` v7, `firebase-admin` v14 — só API modular) | | callables, triggers, cron, HTTP |
| Banco | Cloud Firestore | | ver §6 |
| Auth | Firebase Authentication (e-mail/senha + Google) | | Google via popup; perfil completado com data de nascimento |
| Arquivos | Cloud Storage for Firebase | | fotos de perfil e de evento |
| Push | Firebase Cloud Messaging (Web Push / VAPID) | | tokens em `fcmTokens` |
| Anti-abuso | Firebase App Check (reCAPTCHA v3) | | ver §7 |
| Analytics | Google Analytics 4 via Firebase, com Consent Mode v2 | | |
| E-mail | Resend (API HTTP) | | redefinição de senha (`functions/email.js`) |
| Hospedagem | Firebase Hosting | | domínio custom `atchei.app.br` |
| Testes | Vitest 4 + @testing-library/react + jsdom | | front e functions |
| Lint | ESLint 10 (flat config) + typescript-eslint + react-hooks + react-refresh | | `npm run lint` |
| CI/CD | GitHub Actions | | `ci.yml` (PR) e `deploy.yml` (push em `main`) |
| CLIs usadas em operação | `firebase-tools`, `gcloud` | | deploy manual, IAM, logs, Secret Manager |
| Assistente de dev | Claude Code (`.mcp.json` aponta o MCP de docs do Asaas, hoje sem uso) | | |

Dependências auditadas em 2026-09-09: 0 vulnerabilidades no front e nas functions (a auditoria diária reprova em alta/crítica).

---

## 3. Arquitetura geral

```
┌────────────────────────── navegador / PWA ──────────────────────────┐
│  React 19 + Vite  ·  React Router  ·  Tailwind  ·  service worker    │
│  src/lib/storage (fachada)  →  SDK Firebase (Auth, Firestore,        │
│  Storage, Functions, Messaging, App Check, Analytics)                 │
└───────┬──────────────┬──────────────┬─────────────────┬─────────────┘
        │              │              │                 │
   Firebase Auth   Firestore     Cloud Storage    Cloud Functions gen2
   (e-mail/senha,  (rules +      (rules: só       ├─ callables (App Check + Auth)
    custom claim    App Check     imagem ≤15MB)    ├─ triggers em registrations
    admin)          aplicado)                      ├─ cron 09:00 lembrete D-1
        │                                          ├─ HTTP /e/:id (Open Graph)
        └──── FCM (push) ◄─────────────────────────┘        │
                                                             ▼
                                              Resend (e-mail)  ·  Secret Manager

  Firebase Hosting (atchei.app.br) ── rewrite /e/** → renderEventOpenGraph
                                   ── demais rotas → index.html (SPA)
  Google Maps Platform (Embed / JS / Places) — chave de browser restrita por referrer
```

Princípios:

- **Sem servidor próprio.** O cliente fala direto com Firestore/Storage; as **security rules** são a camada de autorização de dados. Cloud Functions existem só para o que exige privilégio (Admin SDK) ou segredo (e-mail), para reagir a escritas (contadores) e para o cron.
- **Contadores são do backend.** `registrationCount` e `soldByTicket` são escritos exclusivamente por triggers (Admin SDK); as rules bloqueiam escrita do cliente.
- **Um único projeto Firebase** (`atchei`). Não há ambiente de dev separado — ver §8.
- **Sessão local + verdade no token.** O usuário é cacheado em `localStorage` para a UI abrir rápido; `onAuthStateChanged` e o custom claim do token são a fonte da verdade.

---

## 4. Frontend

### 4.1 Estrutura de pastas

```
src/
  App.tsx                 rotas, providers, layout
  main.tsx                bootstrap (migração de chaves do localStorage, render)
  index.css               tema base, animações (@keyframes), utilitários
  pages/                  uma tela por arquivo
  components/
    ui/                   Button, Input, Modal, Skeleton, EmptyState
    Admin/                NewPartnerModal, EditPartnerModal, ConfirmModal
    CreateEvent/          DateTimePickerModal, LocationPickerModal, ImageCropModal
    EventDetails/         EventHeader, EventLocationMap, EventTicketSection
    Profile/              EditProfileModal, ParticipantsModal, ManualTicketModal
    (raiz)                MainLayout, BottomNav, Sidebar, PrivateRoute, EventCard,
                          ProfileCard, TicketModal, CookieBanner, InstallAppCard,
                          NotificationToggle, ErrorBoundary, InstagramIcon
  contexts/AuthContext.tsx
  hooks/                  useRateLimit, useEscapeToClose, useInstallCardPending
  lib/
    firebase.ts           init do app, App Check, Analytics/consent, Functions (lazy)
    storage/              fachada de dados (ver 4.4)
    notifications.ts      FCM: suporte, permissão, token, foreground
    formatters.ts         datas, telefone, CPF, links (wa.me, Maps, Google Agenda), máscaras
    ticketCode.ts         código curto ATX-XXXX-XXXX
    imageUtils.ts         compressão, recorte, detecção de vídeo, dataURL→Blob
    storageKeys.ts        chaves do localStorage (prefixo @atchei:)
    utils.ts              cn() (clsx + tailwind-merge) e goBack()
  test/                   setup.ts (jest-dom, matchMedia) e firebase.mock.ts
```

### 4.2 Rotas (`src/App.tsx`)

| Rota | Tela | Acesso | Observação |
|---|---|---|---|
| `/` | Feed | público | `/feed` redireciona para `/` |
| `/search` | Search | público | busca de eventos + diretório de profissionais |
| `/agenda/:id` | Agenda | público | eventos futuros de um perfil |
| `/event/:id` | EventDetails | público | mapa, inscrição, compra via WhatsApp |
| `/login`, `/register`, `/change-password` | autônomas (sem barra) | público | |
| `/auth/action` | AuthAction | público | handler das ações de e-mail do Auth |
| `/privacidade`, `/termos`, `/quem-somos` | Legal | público | |
| `/validar/:eventId` | ValidateTickets | dono do evento / admin (checado na tela) | scanner em tela cheia |
| `/desafio/:mesa` | Desafio | público (jogar exige login) | "Desafio da Kombi": QR da mesa; grupo de 5 em 3 min ganha o prêmio |
| `/create`, `/edit/:id` | CreateEvent | `PrivateRoute` | |
| `/profile` | Profile | `PrivateRoute` | meus eventos / inscrições, edição de perfil |
| `/admin` | AdminDashboard | `PrivateRoute` + `role === 'admin'` | |

`MainLayout` envolve as rotas com barra inferior (`BottomNav`) e `Sidebar`. Todas as rotas são `lazy` dentro de um `Suspense`. Links compartilhados usam `/e/:id`, que o Hosting reescreve para a function de Open Graph (§5.3) — ela redireciona o navegador para `/event/:id`.

### 4.3 Estado e sessão

- `AuthContext` expõe `user`, `isLoading`, `logout`, `updateUser`. Na montagem lê o usuário do `localStorage` (`@atchei:user`) para não travar a UI, depois `onAuthStateChanged` confirma o token e lê o **custom claim** `admin` (`getIdTokenResult`), corrigindo `role` se necessário. Também sincroniza o token de push.
- O objeto `User` (`id`, `name`, `username` = e-mail, `role`: `user | partner | admin`, `profileId`, `imageUrl`) é o que as telas usam; dados completos do perfil vêm do Firestore quando a tela precisa.
- Contas **legadas** podem ter documento de perfil com id ≠ uid; o vínculo é o e-mail (`profileId` carrega o id real do doc). Regras e código tratam os dois casos.

### 4.4 Camada de dados (`src/lib/storage`)

Fachada única `storage` que funde cinco módulos, para as telas não conhecerem o Firestore diretamente:

| Módulo | Principais funções |
|---|---|
| `auth.ts` | `getCurrentUser`, `register` (18+, tipo user/profissional, envia verificação de e-mail), `login`, `logout`, `updatePartnerPassword`, `updatePartnerProfile`, `getProfileByEmail` |
| `profiles.ts` | `getProfiles`, `getPublicProfiles` (só tipos profissionais — restrição espelhada nas rules), `getProfileById`, `saveProfile`, `updateProfile` |
| `events.ts` | `getEvents`, `getPaginatedEvents` (10 por página, cursor), `getUpcomingEvents`, `saveEvent`, `deleteEvent`, `getEventById`, `getAgendaByProfileId` |
| `registrations.ts` | `saveSelfRegistration` (id determinístico `eventId_uid`), `saveRegistration` (manual), `getRegistrationsForUser/ForEvent` (+ paginada), `getUserRegistration`, `checkInRegistration`, `confirmRegistrationPayment`, `deleteRegistration` |
| `files.ts` | `uploadFile` (Storage; nome único por timestamp e `cacheControl` imutável de 1 ano, para o aparelho não baixar o mesmo pôster a cada visita) |
| `types.ts` | tipos de domínio, `EVENT_CATEGORIES`, `eventoVigente`, `soldCount`, `STATUS_AGUARDANDO`, `STATUS_PAGO_WHATSAPP` |

### 4.5 PWA, push e analytics

- **PWA**: `vite-plugin-pwa` com `registerType: 'autoUpdate'` e manifest (nome, cores `#FFB34D`/`#FFFCF8`, ícones, `display: standalone`). `InstallAppCard` convida à instalação; `useInstallCardPending` coordena com o `CookieBanner` (os dois ocupam a mesma posição — o convite aparece primeiro).
- **Push**: `notifications.ts` registra o token FCM (chave VAPID em `VITE_FIREBASE_VAPID_KEY`; sem ela o recurso se desliga sozinho) em `fcmTokens/{token}` com o `userId`; o backend envia via `sendEachForMulticast` e limpa tokens inválidos. `NotificationToggle` no perfil. No iPhone o push só existe com o app instalado na tela inicial (iOS 16.4+): no Safari o toggle vira "Instale o app para receber lembretes" e abre o guia, em vez de sumir. O lembrete D-1 sai só por push; quem não tem push não recebe.
- **Analytics + LGPD**: GA4 sobe sempre, mas em **Consent Mode v2** — sem consentimento mede sem cookie (interesse legítimo); com "aceitar" no `CookieBanner` grava `_ga`. Publicidade sempre negada. `cookie_domain: 'none'` evita o bug do domínio `.web.app` na Public Suffix List.
- **App Check** no cliente: `initializeAppCheck` com `ReCaptchaV3Provider` quando `VITE_RECAPTCHA_SITE_KEY` existe; em dev usa o token de depuração fixo de `VITE_APPCHECK_DEBUG_TOKEN` (`.env.local`).

### 4.6 UI e design

Tema em `tailwind.config.js`: `background #FFFCF8`, `surface #FFFFFF`, `primary #FFB34D` (âmbar), `accent #A66300`, texto preto, `textMuted #78716C`, `danger`, `success`, `warning`; fonte única **Plus Jakarta Sans** (aliases `display`/`mono` apontam para ela — hierarquia por peso). Animações de entrada são `@keyframes` em CSS, sem biblioteca. `docs/identidade-visual.md` registra a paleta/tipografia do sistema "Organic" usado em peças de marketing — **não** é o tema implementado no app.

Convenções de UI adotadas em 2026-09: status de evento no perfil como texto solto ("Aberto" em `#2E8B57`, "Encerrado" em cinza), contadores e e-mails sem pill/contorno, abas ativas do painel admin em `accent`.

---

## 5. Backend (Cloud Functions)

Todas em `functions/index.js`, região `us-central1`, Node 22, gen2. Callables usam `onCall({ cors: true, enforceAppCheck: true })` e checam `request.auth` e, quando for o caso, `isCallerAdmin(token)` (claim).

### 5.1 Callables

| Function | Quem chama | O que faz | Proteções |
|---|---|---|---|
| `adminResetPassword` | admin (painel, editar parceiro) | redefine a senha de um uid e marca `mustChangePassword` | auth + claim admin + rate limit 3/5min por admin |
| `adminDeleteAccount` | admin (painel, excluir parceiro) | apaga **tudo** da conta: eventos criados (uid ou id de perfil legado) e as inscrições deles, inscrições próprias, `fcmTokens`, usuário do Auth e docs de perfil. Recusa apagar a conta do próprio chamador | auth + claim admin |
| `criarIngressoTeste` | admin (página do evento) | gera ingresso de teste validável (`isTeste: true`, `pedidoId` determinístico `TESTE-<evento>-<admin>`), sem mexer em contagens | auth + claim admin |
| `solicitarResetSenha` | tela de login | gera o link de redefinição via Admin SDK e envia por **Resend** com template próprio (o Google recusa personalizar os templates deste projeto) | rate limit 3/15min por e-mail; segredos `RESEND_API_KEY`, `EMAIL_FROM` |

### 5.2 Triggers do Firestore (`registrations/{id}`)

| Trigger | Efeito |
|---|---|
| `onRegistrationCreated` | `registrationCount +1` (e `soldByTicket.<lote> +1` em venda manual). Ignora ingressos de teste e intenções `'Aguardando pagamento'`. Envia push de confirmação de presença gratuita |
| `onRegistrationDeleted` | simétrico: `-1`. Se o evento já foi apagado, o erro é engolido e logado |
| `onRegistrationConfirmed` | transição `'Aguardando pagamento'` → `'Pago (WhatsApp)'`: entra na contagem e avisa o comprador por push (e o inverso, se um admin reverter) |
| `onDesafioLiberado` (`desafios/{mesa}`) | quando a mesa passa de <5 para 5 membros, carimba os 5 em `desafioGanhadores/{uid}` (1 vitória por conta; as rules recusam quem tem carimbo) |

### 5.3 HTTP e cron

- `renderEventOpenGraph` (`onRequest`, público): servido no rewrite `/e/**` do Hosting. Lê o evento, monta HTML com meta tags Open Graph (título, descrição, imagem) e redireciona navegadores para `/event/:id`. Base URL em `APP_BASE_URL`.
- `lembreteEventosD1` (`onSchedule`, `0 9 * * *` America/Sao_Paulo): `reminders.js` busca eventos de amanhã (exceto testes) e envia push para os inscritos.

### 5.4 Módulos auxiliares

- `rateLimiter.js`: contadores transacionais na coleção `_rateLimits` (bloqueada para clientes). Limites em `LIMITS`.
- `email.js`: `enviarEmailResetSenha` via `fetch` na API do Resend.
- `ogPreview.js`: `handleOgPreview`, com `escapeHtml`.
- `adminEmails.js`: `ADMIN_EMAILS` (fonte do script de claims) e `isCallerAdmin`.
- `scripts/set-admins.js`: concede `admin: true` aos e-mails da lista (precisa de credencial de service account/ADC). `scripts/set-user-password.js`: repõe senha e marca e-mail verificado.

---

## 6. Modelo de dados (Firestore)

| Coleção | Id | Campos principais | Quem escreve |
|---|---|---|---|
| `profiles` | uid (contas novas) ou id legado | `name`, `email`, `type` (`user` / `profissional` / `admin` / legados), `description`, `imageUrl`, `instagram`, `birthDate` (YYYY-MM-DD), `mustChangePassword` | o dono (sem mudar `type`/`email`), admin, functions |
| `events` | auto | `title`, `date` (YYYY-MM-DD), `time`, `location`, `address`, `mediaUrls[]`, `category`, `publicType`, `description`, `creatorId`, `creatorName`, `creatorImageUrl` (nome/foto de quem criou, gravados na criação: a página do evento não lê o perfil), `hasPresence`, `hasTickets`, `ticketPrice`, `whatsappContacts[{name, phone}]`, `maxParticipants`, `tickets[]`, `isTestEvent`, `registrationCount`*, `soldByTicket`* | criador (uid ou perfil legado), admin; * só backend |
| `registrations` | **`eventId_uid`** para inscrição própria; auto para manual/teste | `eventId`, `userId`, `userName`, `userEmail`, `userPhone`, `userCpf`, `paymentStatus`, `timestamp`, `ticketTypeId/Name`, `pedidoId`, `checkedIn`, `checkedInAt`, `checkedInBy`, `isTeste` | o próprio usuário (regras estritas), dono do evento, admin, functions |
| `fcmTokens` | o token | `userId`, `token`, `updatedAt` | o dono; leitura só pelo backend |
| `_rateLimits` | `<escopo>_<chave>` | contadores/janelas | só functions |
| `config` | `desafio` | `aberto` (bool) | **interruptor do Desafio da Kombi**, ligado/desligado pelo admin na aba "Desafios" do painel. Leitura pública (a tela explica "não está rolando" antes do login); escrita só admin. As rules de `desafios` leem este doc: **doc ausente ou `aberto != true` = fechado**, ninguém inicia nem entra |
| `desafios` | a mesa (`mesa-3`) | `mesa`, `liderId`, `membros[]` (uids), `iniciadoEm` (servidor), `liberadoEm` (servidor, ao 5º), `entregueEm` (servidor, pelo admin) | só com `config/desafio.aberto == true`: líder inicia/reinicia; cada membro só adiciona a si mesmo (rules fazem prazo de 3 min + carência de 5 min pelo relógio do servidor). Mesa que fechou 5 fica **queimada** (não reinicia): 1 prêmio por mesa = estoque. Quem já tem carimbo em `desafioGanhadores` não inicia nem entra. `entregueEm`: só admin, só em mesa com 5, uma vez — troca a tela verde por "Refrigerante retirado" nos 5 celulares. Encerrar o desafio **não** apaga a tela verde de quem já ganhou |
| `desafioGanhadores` | uid | `mesa`, `ganhouEm` (servidor) | só a trigger `onDesafioLiberado`; o dono lê o próprio (1 vitória por conta) |

Invariantes importantes:

- O id determinístico `eventId_uid` garante **no máximo uma inscrição própria por pessoa por evento** (criar sobre doc existente é update, negado).
- `paymentStatus` é o estado da inscrição: ausente/`'Gratuito'` = presença; `'Aguardando pagamento'` = intenção (não é ingresso, não conta); `'Pago (WhatsApp)'` e demais valores manuais = ingresso.
- Evento é **vigente** até o fim do dia da sua data (`eventoVigente`); o feed e a agenda filtram por isso, e o perfil mostra "Encerrado" a partir do dia seguinte.
- `maxParticipants` é um teto **eventual**: em rajada simultânea pode passar 1–2 além (contador atualizado por trigger) — aceito para a V1.

---

## 7. Segurança

### 7.1 Autenticação e autorização

- Firebase Auth com **e-mail/senha** e **Google** (popup). Quem entra com Google sem perfil conclui o cadastro informando só a data de nascimento (as rules exigem 18+ para criar o perfil). Verificação de e-mail é enviada no cadastro por senha e o perfil avisa enquanto não verificar. `?next=` em `/login` e `/register` devolve a pessoa à tela de origem (evento, desafio) — só caminhos internos são aceitos.
- **Admin** = custom claim `admin: true` (concedido pelo `set-admins.js` ou direto pela API do Identity Toolkit). É a única fonte de autorização nas **rules** e nas **functions**. Na interface, o papel vem de `profiles/{id}.type === 'admin'`. Os dois precisam existir.
- O cliente **não pode** mudar `type` nem `email` do próprio perfil (sem auto-promoção); perfil profissional nasce no cadastro ou pelo painel admin.

### 7.2 Firestore rules (`firebase/firestore.rules`)

- `profiles`: **`get` público só para perfil `profissional`** (página do organizador, agenda); perfil de conta pessoal (`user`) e admin só o próprio dono (uid ou e-mail legado) e admin leem, porque o doc tem e-mail e data de nascimento e o uid vaza por `events.creatorId` e `desafios/*.membros` (fechado em 17/09; antes era `get` público). **`list` restrito** (diretório de profissionais, o próprio perfil ou admin — impede dump de nomes+e-mails), `create` só do próprio uid com tipo `user`/`profissional` e **18+ validado na regra**, `update` só do dono por e-mail, `delete` só admin.
- `events`: leitura pública; `create` só com `creatorId` do próprio usuário (uid ou perfil legado); `update`/`delete` só criador ou admin; o criador **não** pode alterar `creatorId`, `registrationCount` nem `soldByTicket`.
- `registrations`: leitura só do dono, do organizador do evento ou admin. Criação própria exige evento com presença habilitada (ou venda, para intenção), capacidade disponível, `userId == uid`, id `eventId_uid`, sem `checkedIn` e sem `paymentStatus` pago. Update do organizador restrito ao check-in (irreversível) e à confirmação `'Aguardando pagamento'` → `'Pago (WhatsApp)'`. Delete: admin, o próprio usuário (só presença/intenção não validadas) ou o organizador (só intenções).
- `fcmTokens`: escrita só do próprio uid, leitura negada. `_rateLimits`: tudo negado.

### 7.3 Storage rules

`profiles/{uid}/*` e `events/{uid}/*`: leitura pública; escrita só do dono ou admin, **apenas imagens** (`jpeg|png|webp|gif|avif`) **até 15 MB**.

### 7.4 App Check

- Cliente: reCAPTCHA v3 (`VITE_RECAPTCHA_SITE_KEY`, chave do projeto `atchei`).
- **Firestore: enforcement APLICADO** (2026-08-31) — requisições sem token válido são recusadas.
- **Callables: `enforceAppCheck: true`** em todas.
- **TTL do token: 7 dias** (2026-09-14; era 1 dia). Cada renovação de token é uma avaliação do reCAPTCHA, gratuito até 10 mil/mês e cobrado acima disso. Com 1 dia, mil usuários ativos por dia estouram a cota em dez dias; com 7 dias, a mesma base fica dentro dela. Configurado pela API `recaptchaV3Config.tokenTtl`, não vive no código.
- **Storage e Authentication: não aplicados, de propósito.** As fotos carregam por URL direta em `<img>` (sem token) e as rules já restringem a escrita; Auth é pré-lançamento. Não aplicar.
- Dev: token de depuração fixo por máquina (`VITE_APPCHECK_DEBUG_TOKEN` em `.env.local`), registrado no console. Sem isso cada `npm run dev` conta como "sem verificação" na métrica.

### 7.5 Outras camadas

- **Rate limiting** transacional nas callables sensíveis (reset de senha por e-mail e por admin). Spam de inscrições é contido pelo id determinístico + App Check.
- **Headers do Hosting**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- **Segredos**: `RESEND_API_KEY` e `EMAIL_FROM` no **Secret Manager** (bind via `defineSecret`); nenhum `.env` é versionado (regra do projeto). As chaves `VITE_*` são públicas por design; a do Maps é restrita por referrer e por API.
- **Entrada do usuário**: React escapa por padrão (zero `dangerouslySetInnerHTML`); o OG preview escapa HTML no servidor; upload limitado por tipo/tamanho.
- **Senhas temporárias** de parceiros são geradas com `crypto.getRandomValues` e mostradas uma única vez.

---

## 8. Ambientes e configuração

| Item | Valor |
|---|---|
| Projeto Firebase/GCP | `atchei` (número 872742778582) |
| Hosting | site `atchei` → `atchei.web.app`, domínio custom **`atchei.app.br`** |
| Região das functions | `us-central1` |
| Chave do Maps | `atchei-maps-web`, projeto `atchei`, restrita a Maps Embed + Maps JavaScript + Places e aos referrers `atchei.app.br`, `www.atchei.app.br`, `atchei.web.app`, `atchei.firebaseapp.com`, `localhost:5173/5174/4173`, `127.0.0.1:5173` |
| reCAPTCHA (App Check) | site key registrada no projeto `atchei` |
| Segredos | `RESEND_API_KEY`, `EMAIL_FROM` (Secret Manager) |

**Não há ambiente de desenvolvimento.** `npm run dev` usa o mesmo backend da produção. Trate qualquer ação no localhost como ação em produção.

Variáveis do frontend (`.env`, todas públicas): ver README. `.env.local`: `VITE_APPCHECK_DEBUG_TOKEN`. Variáveis das functions (`functions/.env`, local): `APP_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` — o CI grava um `functions/.env` só com `APP_BASE_URL` a cada deploy (§10); os segredos de produção vêm do Secret Manager.

`localStorage` usa o prefixo `@atchei:` (`user`, `install-dismissed`). Consentimento de cookies em `atchei:cookie-consent`.

---

## 9. Testes

- **Frontend**: Vitest 4, ambiente jsdom, `globals: true`, setup em `src/test/setup.ts` (jest-dom, `cleanup`, mock de `matchMedia`) e `src/test/firebase.mock.ts` (mocks de `firebase/app`, `auth`, `firestore`, etc. — os testes nunca tocam o Firebase real). Testes ficam ao lado do código (`*.test.ts(x)`): páginas (Feed, Login, Register, EventDetails, AuthAction, ValidateTickets), componentes (EventCard, CookieBanner, InstallAppCard, EventHeader, EventLocationMap, EventTicketSection, DateTimePickerModal, Button) e libs (formatters, cpf, imageUtils, storageKeys, storage, useRateLimit). **93 testes** em 20 arquivos em 2026-09-01.
- **Functions**: Vitest com `firebase-functions-test`; cobre `rateLimiter`, `reminders` e `ogPreview`.
- Comandos: `npm run test:run` (CI), `npm test` (watch), `npm run test:coverage`; `cd functions && npm test`.
- Filosofia: uma verificação executável por lógica não trivial; nada de suítes por função.

---

## 10. CI/CD

### `ci.yml` — Pull Requests para `main`

`npm ci` → recria `.env` a partir do secret `VITE_ENV` → `npm run build` (tsc + vite) → `npm run test:run` → `npm ci` e `npm test` em `functions/`. Check "Build e Testes".

### `auditoria-diaria.yml` — todo dia às 06:00 (SP) e sob demanda

Não deploya. Build, testes (front e functions), `npm audit --audit-level=high` (front e functions), higiene (nenhum `.env` versionado, nenhum `dangerouslySetInnerHTML`) e smoke de produção (site, páginas legais, function de OG, e confere que o bundle publicado — incluindo os chunks — carrega a site key do App Check e a chave VAPID). Falha → e-mail do GitHub. Na primeira execução achou uma crítica nas dependências das functions (corrigida no #34).

### `deploy.yml` — push em `main` (a cada merge)

Mesmos testes e build, grava `functions/.env` (só `APP_BASE_URL=https://atchei.app.br`, porque o deploy sobrescreve variável de ambiente mas não limpa uma antiga), depois `firebase-tools deploy --only hosting,firestore:rules,storage,functions --force --project atchei` autenticado pelo secret `FIREBASE_SERVICE_ACCOUNT` (JSON gravado em `GOOGLE_APPLICATION_CREDENTIALS`). `concurrency: deploy-producao` com `cancel-in-progress: false`: um deploy por vez, nunca cancelado no meio (merges seguidos podem marcar o run intermediário como *cancelled* — o último é o que vale). `--force` confirma sozinho a exclusão de functions removidas do código.

### `backup-semanal.yml` — domingo às 03:00 (SP) e sob demanda

Cópia de tudo que vive só no Google: `firebase auth:export` (usuários com hash de senha), `functions/scripts/backup-firestore.js` (todas as coleções de raiz em JSON, datas em ISO) e `gcloud storage rsync` do bucket. Empacota, criptografa com `gpg` simétrico (secret `BACKUP_PASSPHRASE`) e publica como artefato do GitHub por 90 dias. Motivo: o backup gerenciado do Firestore fica dentro do mesmo projeto e não vale nada se o projeto for suspenso; este sai do Google. Preparação e restauração em §11.

### Limitações conhecidas

- A service account do CI **não consegue criar function nova** (falha em "Could not get operation details" / IAM). Primeiro deploy de uma function nova é manual — ver §11.
- Não há branch protection na `main` (plano gratuito com repositório privado); o fluxo por PR é convenção.
- Se o run de deploy falha na etapa de functions, o **hosting não sobe** naquele run — refaça o run depois de corrigir.

---

## 11. Operações (runbooks)

**Function nova não sobe pelo CI** → com a conta owner logada no `firebase-tools`:
```
npx firebase deploy --only functions:<nome> --project atchei --force
```
O *create* feito pelo owner configura sozinho o invoker público (`allUsers` → `roles/run.invoker`, necessário para callables — a segurança fica dentro da function). Depois, `Re-run` do workflow que falhou para subir o hosting. Se a function tiver ficado meio-criada (registro sem serviço Cloud Run), `firebase functions:delete` e deploy de novo.

**Criar uma conta admin** (quatro peças):
1. Usuário no Auth (console, ou API `accounts` do Identity Toolkit com token gcloud + header `X-Goog-User-Project: atchei`).
2. Custom claim `{ "admin": true }` (`scripts/set-admins.js` com ADC, ou `accounts:update` com `customAttributes`).
3. Documento `profiles/{uid}` com `type: 'admin'`, `name`, `email`.
4. E-mail em `functions/adminEmails.js` (fonte do script) via PR.

**Excluir uma conta por completo** → painel admin → Parceiros → lixeira (usa `adminDeleteAccount`). O admin logado não consegue apagar a si mesmo.

**Registrar máquina de dev no App Check** → rodar o app uma vez, copiar o token de depuração do console do navegador, registrar em Firebase → App Check → Apps → tokens de depuração, e fixá-lo em `.env.local` (`VITE_APPCHECK_DEBUG_TOKEN`). Reiniciar o `npm run dev`.

**Mapa do evento com 403** → o referrer da página não está na lista da chave do Maps (ou o navegador não envia Referer). Diagnóstico: `curl -H "Referer: https://<origem>/" "https://www.google.com/maps/embed/v1/place?key=<chave>&q=teste"`. Ajuste: `gcloud services api-keys update <key> --allowed-referrers=... --api-target=service=maps-embed-backend.googleapis.com --api-target=service=maps-backend.googleapis.com --api-target=service=places.googleapis.com --project=atchei`.

**Link de compartilhamento ou de e-mail apontando para localhost** → `APP_BASE_URL` errada no ambiente da function deployada. O deploy sobrescreve a variável mas não limpa uma antiga; em 2026-09-15 `renderEventOpenGraph` e `onRegistrationCreated` estavam com `http://localhost:5173` desde um deploy manual. Conferir: `gcloud functions describe <fn> --gen2 --region <us-central1|southamerica-east1> --format='value(serviceConfig.environmentVariables)' --project atchei`. Corrigir: qualquer deploy pelo CI (ele grava `functions/.env` com o valor certo). A CDN guarda o HTML de `/e/` por 10 min (`s-maxage=600`); para conferir na hora, acrescente `?v=1` à URL. A auditoria diária confere o redirect de `/e/`.

**Ver logs das functions** → `gcloud logging read 'resource.type="cloud_run_revision" severity>=WARNING' --project=atchei --limit=30` ou `npx firebase functions:log`.

**Monitoramento** → Cloud Monitoring do projeto `atchei`: uptime check de `https://atchei.app.br/` a cada 5 min com alerta por e-mail para contato.atchei@gmail.com ("Atchei - site fora do ar", dispara após 5 min de falha). Orçamento com alertas na conta de faturamento "Pagamento do Firebase".

**Backup: preparar** → (1) gerar a frase com `openssl rand -base64 32`, gravar no secret `BACKUP_PASSPHRASE` do repositório **e** num gerenciador de senhas fora do GitHub; (2) copiar os parâmetros de hash de senha (Firebase → Authentication → Users → menu de três pontos → "Password hash parameters": `algorithm`, `base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`) para o mesmo gerenciador de senhas. Sem eles as senhas exportadas não podem ser importadas em lugar nenhum. (3) Rodar o workflow uma vez pelo botão "Run workflow" e baixar o artefato para confirmar que abre.

**Backup: restaurar** → baixar o artefato, `gpg -d atchei-backup-AAAAMMDD.tgz.gpg > backup.tgz` (pede a frase), `tar -xzf backup.tgz`. Dentro: `auth.json`, `firestore/<colecao>.json` (mapa `id → documento`), `storage/`. Para voltar ao Firebase: `npx firebase auth:import auth.json --hash-algo=SCRYPT --hash-key=<base64_signer_key> --salt-separator=<base64_salt_separator> --rounds=<rounds> --mem-cost=<mem_cost> --project <projeto>`; Firestore via script curto com `firebase-admin` lendo os JSON (datas voltam com `new Date(iso)`); Storage com `gcloud storage rsync -r`. Para outro provedor: o JSON é o formato de entrada, e o Supabase tem importador de usuários do Firebase que aceita esses hashes.

**Validar rules antes do deploy** → `node -e` que serializa `firebase/firestore.rules` em `{source:{files:[{name,content}]}}` e `POST https://firebaserules.googleapis.com/v1/projects/atchei:test` com token do gcloud e header `X-Goog-User-Project: atchei`; resposta `{}` = compila.

**Checks locais que o CI não perdoa** → `npx tsc -b` (não `tsc --noEmit` na raiz) e, nas functions, `node -e "require('./index.js')"` — os testes não carregam o `index.js`, o deploy carrega.

**Login com Google** → provedor habilitado no Firebase Auth; `authDomain` = `atchei.app.br`; o cliente OAuth "Web client (auto created by Google Service)" precisa do redirect `https://atchei.app.br/__/auth/handler`; o service worker não pode interceptar `/__/` (`navigateFallbackDenylist` no `vite.config.ts`); header `Cross-Origin-Opener-Policy: same-origin-allow-popups` no Hosting.

**Desafio da Kombi (operação da noite)** → o desafio nasce **fechado**: antes de soltar os QR (e antes de qualquer ensaio), entrar como admin em `/admin`, aba **Desafios**, e apertar **Liberar desafio**. A mesa que fechar os 5 aparece na fila com os nomes; ao entregar o refrigerante, apertar **Entregue** (queima o comprovante nas 5 telas). **Encerrar desafio** (com confirmação) derruba as rodadas em andamento quando o estoque acabar; quem já ganhou mantém a tela verde.

**Desafio da Kombi (reset da mesa de teste)** → apagar `desafios/mesa-teste` e os docs de `desafioGanhadores` dos participantes no console do Firestore. Uma mesa real que ganhou fica queimada de propósito; para reaproveitar, apagar o doc da mesa.

**Rotacionar segredo** → `npx firebase functions:secrets:set RESEND_API_KEY --project atchei` e redeploy das functions que o usam.

**Atualizar o `.env` de produção** → editar o secret `VITE_ENV` do repositório (é o conteúdo integral do `.env`); vale a partir do próximo deploy.

**Ruído no console do navegador que não é bug do app**: `Uncaught TypeError ... reading 'startTime'` em `VM<n>` (web-vitals injetado pelo DevTools 152), `net::ERR_QUIC_PROTOCOL_ERROR` no canal Listen do Firestore (rede; o SDK reconecta), aviso de domínio não autorizado para OAuth (o app não usa OAuth), 400 do `identitytoolkit` em senha errada (tratado com toast).

---

## 12. Convenções de trabalho

- **Fluxo**: branch → commits → PR → CI verde → merge (squash) → deploy automático. Nunca push direto na `main`.
- **Commits e PRs em português**, no formato `tipo(escopo): descrição` (`feat`, `fix`, `chore`, `refactor`, `docs`).
- **Minimalismo deliberado** ("ponytail"): reutilizar o que já existe, preferir plataforma/stdlib a dependência, sem abstração de uma implementação só. Simplificações conscientes levam comentário `ponytail:` com o teto e o caminho de evolução.
- **Comentários explicam o porquê**, não o quê — especialmente em rules e triggers, onde a intenção de segurança precisa sobreviver a quem ler depois.
- **Nenhum `.env` no git**, mesmo com valores públicos.
- Código de UI: Tailwind utilitário, componentes pequenos por domínio, tokens de cor do tema (nada de hex solto, salvo decisão pontual documentada).

---

## 13. Decisões e histórico

| Quando | Decisão |
|---|---|
| 2026-08-13 | App Check (reCAPTCHA v3) integrado em modo monitoramento |
| 2026-08-24 | Venda in-app por Pix (Asaas) colocada em stand-by; venda passa a ser via WhatsApp com intenção de compra na lista do vendedor |
| 2026-08-31 | **Integração Asaas removida do código** (`functions/asaas.js`, componentes de lote/financeiro, `flags.ts`); segredos `ASAAS_*` e webhook sandbox apagados em 2026-09-01. Pagamento futuro será implementação nova |
| 2026-08-31 | **App Check aplicado** no Firestore e nas callables; Auth e Storage ficam de fora de propósito |
| 2026-09-01 | Chave do Google Maps migrada para o projeto `atchei` (antes vivia em outro projeto GCP); domínio `atchei.app.br` incluído nos referrers |
| 2026-09-01 | `adminDeleteAccount`: exclusão de parceiro passa a apagar login, perfil, eventos, inscrições e tokens |
| 2026-09-01 | Botão voltar com fallback (`goBack`) em todas as telas; limpeza de código morto pós-Pix; dependências sem vulnerabilidades |
| 2026-09-02 | Conta admin oficial `contato.atchei@gmail.com`; contas de teste antigas excluídas em seguida |
| 2026-09-02 | Push (FCM) ligado de fato: `VITE_FIREBASE_VAPID_KEY` no `.env`/`VITE_ENV`; sininho de notificações no perfil |
| 2026-09-03 | E-mail de verificação com template e página do app (callable `solicitarVerificacaoEmail` via Resend) |
| 2026-09-04 | Auditoria diária (GitHub Actions), uptime check + alerta no Cloud Monitoring, orçamento no faturamento, `www` no Hosting |
| 2026-09-08 | **Desafio da Kombi** (`/desafio/:mesa`), login com Google, `?next=` no login/cadastro; `authDomain` = `atchei.app.br`; PWA deixa `/__/` e `/e/` para o servidor |
| 2026-09-09 | `firebase-admin` 14 / `firebase-functions` 7 (API modular), 0 vulnerabilidades no front e nas functions (`overrides` de `uuid`), SA do CI com `run.admin` |
| 2026-09-10 | Desafio: prazo de 3 min; mesa vencedora queimada; 1 vitória por conta (trigger `onDesafioLiberado`); `CLAUDE.md` no repo |
| 2026-09-11 | Desafio: aba "Desafios" no painel admin — interruptor `config/desafio.aberto` lido pelas rules (nasce fechado), fila de entrega ao vivo, botão "Entregue" (`entregueEm`); Theo entra como segundo dev (#49). Fix: encerrar não esconde a tela verde de quem ganhou; "Encerrar" pede confirmação |
| 2026-09-15 | Backup semanal validado de ponta a ponta (run manual + `gpg -d` na máquina do Allan); PR #53 em produção. Bug achado no smoke: `APP_BASE_URL=http://localhost:5173` em duas functions deployadas à mão, links de compartilhamento iam para localhost → CI passa a gravar `functions/.env`; auditoria diária confere o redirect de `/e/` |
| 2026-09-15 | Limpeza da auditoria de over-engineering (`/ponytail-audit`): migração `@chain:` aposentada; callable `tornarProfissional` removida (nunca chamada pelo app); compat de tipos `atletica`/`estabelecimento` e do prefixo `CHN` retirada (nenhum dado legado no Firestore); campo `sold` removido; sobras do Asaas em functions, `.env.example` e textos legais; hookup de emulador; `escapeHtml` único; `compressImage` devolve `File` sem ida e volta por base64 |
| 2026-09-14 | **Infra fica no Firebase; debate de plataforma encerrado até um gatilho disparar** (ver "Custo e plataforma" abaixo). Ajustes de custo e lançamento: busca de evento por id (era listar 50), pôster comprimido e com cache imutável, aviso de instalação no iPhone para receber push, TTL do App Check em 7 dias, proteção contra exclusão do Firestore, backup semanal criptografado fora do Google |
| 2026-09-17 | Capa em pé: flyer 9:16 (formato de Story) sobe inteiro pelo botão "Usar a imagem inteira" no recorte e aparece inteiro sobre uma cópia desfocada nas três molduras (cartão de destaque, cartão da lista, topo do evento) via `components/CapaEvento`; foto deitada continua preenchendo. Motivo: o recorte 16:9 obrigatório guardava um terço do flyer |
| 2026-09-17 | Segurança (achado fora do relatório de auditoria de 16/09): perfil de conta pessoal deixa de ser legível por id (`get` só dono/admin; profissional segue público); nome/foto do criador passam a ficar no evento (`creatorName`/`creatorImageUrl`, script `preencher-criador-eventos.js` para os antigos); painel admin mostra "Criado por"; HSTS no Hosting; rate limiter fail-closed nas rotas de e-mail. CSP ficou de fora de propósito (quebraria login Google, reCAPTCHA e Maps) |
| 2026-09-21 | Performance da home (PageSpeed 60 no celular, medido com o feed vazio porque o robô não passa no reCAPTCHA do App Check): fonte Plus Jakarta Sans servida de `public/fonts` (sem CSS externo bloqueando a renderização); `initializeAuth` sem resolvedor de popup (o `getAuth` baixava `/__/auth/iframe.js` e a gapi em toda visita); Analytics depois do `load`; `Cache-Control immutable` em `/assets/**` e `/fonts/**`; contraste e nomes acessíveis corrigidos. Em seguida, capas: primeira capa da tela com `fetchpriority=high`, demais `loading=lazy`; upload em WebP (JPEG onde o navegador não codifica; o LCP real era um flyer JPEG de 380 KB). O que resta do tempo de bloqueio é o reCAPTCHA do App Check, decisão fechada; a nota do PageSpeed não passa da faixa de 70 com ele ligado. |

### Custo e plataforma (2026-09-14)

Discutimos migrar para plataformas mais comuns no mercado (Supabase/Postgres, Cloudflare R2 e Pages, API própria em PaaS, SSR). Decisão: **não agora**. O raciocínio, para não reabrir sem dado novo:

- **Uso real medido no Cloud Monitoring, 30 dias**: ~46,7 mil leituras (1,5 mil/dia contra 50 mil/dia grátis), 132 escritas, 11 MB de egress do Storage, 352 chamadas de function. Banco com 1 evento, 4 inscrições, 6 perfis. Conta: zero.
- **Preços confirmados no catálogo de billing**: leitura em São Paulo USD 0,04 por 100 mil, escrita USD 0,14 por 100 mil; download do Storage USD 0,12/GB **sem cota gratuita** (a cota só vale para bucket nos EUA); functions em Iowa, dentro dos 2 milhões de chamadas grátis.
- **Projeção mensal, USD, sessão = 1 feed + 2 páginas de evento**: 300 sessões/dia → 2 (hoje) / 0 (após ajustes); 3 mil/dia → 30 / 12; 30 mil/dia (irreal para Cáceres) → ~1.040 / ~100. Supabase Pro tem piso de USD 25 e não elimina egress de imagem nem proteção contra bot. Nas escalas realistas o Firebase sai mais barato; na irreal, empatam.
- **O que de fato pesa na fatura aqui**, em ordem: avaliações do reCAPTCHA via App Check (escala com pessoas, controlado pelo TTL), egress de imagem (comprimir + cache resolve até ~8 mil sessões/dia; R2 zera), leituras do Firestore (buscar por id, nunca listar para achar). Nenhum exige trocar de plataforma.
- **O que o mercado faz e por quê**: Postgres domina onde o dado tem vários consumidores (BI, financeiro, integrações) e onde se contrata por SQL. Firebase é usado na borda (Auth, push, analytics) e raramente como banco central. O Atchei tem um consumidor e dois devs; quando tiver relatório cruzando eventos ou um segundo sistema lendo o dado, a migração do banco passa a fazer sentido, e a camada `src/lib/storage` é o que a deixa barata.
- **Riscos que não dependem de escala e já foram tratados**: o Google não tem teto de gasto (só alerta); o backup gerenciado do Firestore vive no mesmo projeto e não protege contra suspensão de conta. Daí o backup semanal fora do Google e a proteção contra exclusão do banco.
- **Verificado e descartado**: functions "em Iowa longe do banco" (as quatro disparadas pelo Firestore já rodam em São Paulo; as de Iowa são callables raras, OG para robôs e o cron); "12 functions = fragmentação" (um arquivo, um deploy, testes por módulo; o que pesa no cold start são `require` no topo, não linhas); Cloudflare Pages (quebraria o handler de login em `/__/` e o rewrite de `/e/`); SSR para o Open Graph (a rota já tem `s-maxage=600` na CDN; se o cold start incomodar, `minInstances: 1`); DNS do Resend (DKIM, SPF e DMARC já estavam no ar).

**Gatilhos que reabrem o debate** (qualquer um): métrica dentro do app cruzando inscrição com perfil ou comparando períodos entre eventos → banco; egress de imagem acima de R$ 50/mês → R2 só para mídia; deploy ou cold start piorando de forma medida, ou SDK pesado entrando → `require` preguiçoso, depois `codebase` separada; fatura total acima de USD 50 por dois meses seguidos → olhar linha a linha antes de decidir.

Legado que o código ainda honra: perfis com id ≠ uid (vínculo por e-mail).
