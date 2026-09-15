# Atchei — instruções para o Claude Code

Leia primeiro: [README.md](README.md) (produto, como rodar) e [docs/DOCUMENTACAO.md](docs/DOCUMENTACAO.md) (arquitetura, dados, segurança, runbooks, histórico de decisões). Este arquivo é o resumo operacional.

## O projeto em 5 linhas

PWA de eventos (React 19 + Vite + Tailwind) sobre Firebase (Auth, Firestore com rules, Storage, Cloud Functions gen2 em Node 22, FCM, App Check). Produção em **https://atchei.app.br**, projeto Firebase/GCP `atchei`. **Não existe ambiente de desenvolvimento: `npm run dev` fala com o backend de produção** — todo dado que você mexer no localhost é real. Admin oficial do app: `contato.atchei@gmail.com` (custom claim `admin` + perfil `type: 'admin'`).

## Fluxo de trabalho

- Branch → commits → PR → merge (squash) → deploy automático pelo GitHub Actions. **Nunca push direto na `main`** (não há branch protection; é convenção).
- Commits e PRs em português, `tipo(escopo): descrição` (`feat`, `fix`, `chore`, `ci`, `docs`).
- **Nenhum `.env` no git**, mesmo com valores públicos. O CI recria o `.env` a partir do secret `VITE_ENV`; se mudar uma variável, o secret precisa ser atualizado também.
- Minimalismo deliberado: reaproveite o que existe, prefira plataforma/stdlib a dependência, sem abstração de uma implementação só. Comentários explicam o **porquê**.

## Checks obrigatórios antes de commitar

```bash
npx tsc -b                 # o check de tipos real (tsc --noEmit na raiz NÃO checa nada: tsconfig só tem referências)
npx vitest run             # front
npx eslint <arquivos>      # o CI não roda lint, mas react-hooks/set-state-in-effect pega coisa real
cd functions && node -e "require('./index.js')" && npx vitest run   # os testes NÃO carregam o index.js; o deploy carrega
```

Rules do Firestore compilam só no deploy; para validar antes: `POST https://firebaserules.googleapis.com/v1/projects/atchei:test` com o arquivo (ver docs §11). Em cadeias de shell, gateie o commit no exit code real (`cmd > log; RC=$?`), nunca em `| grep`.

## Pegadinhas que já custaram deploy

- `firebase-admin` 14 **só tem API modular** (`firebase-admin/app|firestore|auth|messaging`); `admin.firestore()` não existe mais.
- Service worker (vite-plugin-pwa): toda rota servida pelo **servidor** (não pela SPA) precisa estar em `navigateFallbackDenylist` — hoje `/__/` (handler de login do Firebase) e `/e/` (Open Graph).
- `authDomain` é `atchei.app.br`; o cliente OAuth do Google precisa do redirect `https://atchei.app.br/__/auth/handler`.
- Function nova: o CI deploya (a SA tem `run.admin`); se falhar em IAM, o runbook está em docs §11.
- Chave do Maps vive no projeto `atchei`, restrita por referrer; 403 no mapa = referrer fora da lista.

## Decisões fechadas (não reabrir sem o Allan)

- Sem pagamento in-app (Asaas removido em 2026-08-31); venda é via WhatsApp com intenção de compra.
- App Check: aplicado no Firestore e nas callables; **não** aplicar em Storage nem Auth.
- Cadastro exige 18+ (formulário e rules). Presença gratuita nasce desligada em evento novo.
- Desafio da Kombi: prazo **3 min**, carência 5 min **sem mostrar quando reabre**, mesa vencedora queimada, 1 vitória por conta; ideias de trava por uid e cooldown por pessoa foram rejeitadas. Liga e desliga pelo painel admin (`config/desafio.aberto`, lido pelas rules; **nasce fechado**); entrega é carimbada pelo admin (`entregueEm`), sem function nova. Quem já ganhou mantém a tela verde mesmo com o desafio encerrado.
- Tema: âmbar `#FFB34D`, accent `#A66300`, Plus Jakarta Sans; status/contadores sem "pill" com contorno.
- **Infra fica no Firebase** (2026-09-14, após análise de custo com uso real: ~1,5 mil leituras/dia contra 50 mil grátis, 11 MB de egress no mês, conta zero). Não migrar para Supabase/Postgres, não mover mídia para R2, não adotar SSR, não mover functions de região, não quebrar em serviços. Reabrir só se disparar um gatilho: métrica no app cruzando inscrição com perfil ou comparando períodos entre eventos; egress de imagem acima de R$ 50/mês; deploy ou cold start piorando de forma medida; fatura acima de USD 50 por dois meses seguidos. Números e raciocínio em docs §13.
- **Regras de custo** (o que de fato decide a fatura aqui): Firestore só via `src/lib/storage`; buscar documento por id, nunca listar a coleção para achar um; imagem comprimida no upload e com `cacheControl` imutável; TTL do token do App Check em 7 dias; backup semanal criptografado fora do Google (`backup-semanal.yml`, secret `BACKUP_PASSPHRASE`).
