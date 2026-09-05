# Deploy na Coolify

Este projeto tem 3 partes: **Postgres**, **backend** (Express + WhatsApp/Puppeteer) e **frontend** (Next.js).
O jeito mais simples é usar o `docker-compose.yml` da raiz.

## Opção A — Docker Compose (recomendado)

1. Na Coolify, crie um recurso **Docker Compose** apontando para este repositório
   (`https://github.com/rafaelokra1002/DisparaZap.git`, branch `main`).
2. Em **Environment Variables**, defina:

   | Variável | Obrigatória | Observação |
   |---|---|---|
   | `POSTGRES_USER` | recomendado | usuário do banco |
   | `POSTGRES_PASSWORD` | **sim** | senha forte |
   | `POSTGRES_DB` | recomendado | nome do banco |
   | `JWT_SECRET` | **sim** | string longa e aleatória |
   | `FRONTEND_URL` | **sim** | URL pública do frontend (domínio da Coolify) |
   | `BACKEND_URL` | **sim** | URL pública do backend |
   | `NEXT_PUBLIC_API_URL` | **sim** | = `BACKEND_URL` (embutido no build do frontend) |
   | `ADMIN_EMAIL` | opcional | e-mail que vira admin |
   | `MISTIC_PAY_*`, `PIX_*` | opcional | só se usar pagamentos |

3. Configure os **domínios** na Coolify:
   - `frontend` → porta **3000**
   - `backend` → porta **3001**
4. Deploy.

> **Importante:** `NEXT_PUBLIC_API_URL` é embutida no build do frontend. Se mudar o
> domínio do backend depois, é preciso **rebuildar** o frontend.

## Opção B — dois recursos separados (Dockerfile)

Se preferir separar (ex.: escalar frontend/backend independente):

- **Backend**: recurso Dockerfile com `Base Directory = /backend`. Adicione um Postgres
  na Coolify e aponte `DATABASE_URL` para ele. Defina as demais variáveis acima.
- **Frontend**: recurso Dockerfile com `Base Directory = /frontend` e o build-arg
  `NEXT_PUBLIC_API_URL` = URL pública do backend.

## Volumes persistentes (não pule isto)

O backend guarda a sessão do WhatsApp e os arquivos em disco. Sem volumes, a sessão
cai e o QR precisa ser reescaneado a cada deploy. O compose já declara:

- `wa_tokens` → `/app/tokens` (sessão do WhatsApp — **crítico**)
- `wa_uploads` → `/app/uploads` (mídias enviadas)
- `wa_cache` → `/app/.wwebjs_cache`
- `pgdata` → dados do Postgres

## Recursos recomendados

Cada sessão de WhatsApp roda um Chromium headless. Reserve **2 GB+ de RAM** para o
backend (mais se houver várias sessões simultâneas). O `shm_size: 1gb` já está definido
para evitar crashes do Chromium.

## Migrações

O container do backend roda `prisma migrate deploy` automaticamente ao subir, então o
schema é criado/atualizado sozinho no primeiro deploy.
