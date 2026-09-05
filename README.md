# DivulgarZap - Sistema de Disparo WhatsApp

Sistema completo de disparo de mensagens para grupos do WhatsApp com painel web.

## Arquitetura

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express
- **Banco de dados**: PostgreSQL + Prisma ORM
- **WhatsApp**: venom-bot
- **Fila de envio**: BullMQ + Redis

---

## Pré-requisitos

- **Node.js** >= 18
- **PostgreSQL** instalado e rodando
- **Redis** instalado e rodando
- **Google Chrome** ou Chromium (para o venom-bot)

---

## Instalação

### 1. Banco de Dados PostgreSQL

Crie o banco de dados:

```sql
CREATE DATABASE divulgarzap;
```

### 2. Redis

Certifique-se que o Redis está rodando na porta padrão (6379).

- **Windows**: Use [Memurai](https://www.memurai.com/) ou Redis via WSL/Docker
- **Linux/Mac**: `redis-server`

### 3. Backend

```bash
cd backend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
# Edite o arquivo .env com suas credenciais do PostgreSQL

# Gerar cliente Prisma e rodar migrações
npx prisma generate
npx prisma migrate dev --name init

# Criar usuário demo (opcional - abra o Prisma Studio)
npx prisma studio

# Iniciar o servidor
npm run dev
```

O backend rodará em `http://localhost:3001`.

### 4. Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

O frontend rodará em `http://localhost:3000`.

---

## Configuração do .env (Backend)

```env
PORT=3001
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/divulgarzap?schema=public"
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

---

## Criando um Usuário Demo

Acesse o Prisma Studio (`npx prisma studio`) e crie um usuário na tabela User:

- **id**: `demo-user-001`
- **name**: `Usuário Demo`
- **email**: `demo@divulgarzap.com`

---

## Uso

### 1. Conectar WhatsApp

1. Acesse `http://localhost:3000/admin`
2. Clique em **"Conectar WhatsApp"**
3. Escaneie o QR Code com seu celular
4. Aguarde o status mudar para **"Conectado"**

### 2. Criar Anúncio

1. Acesse `http://localhost:3000`
2. Vá na aba **"Meus Anúncios"**
3. Preencha o texto e/ou imagem + legenda
4. Ative os toggles dos tipos de envio desejados
5. Clique em **"Salvar meus anúncios"**

### 3. Disparar

1. Com o anúncio salvo e WhatsApp conectado
2. Clique em **"Disparar"**
3. As mensagens serão adicionadas a uma fila
4. O envio acontece com delay de 5-10s entre cada grupo

### 4. Acompanhar Resultados

- **Visão Geral**: Cards com métricas de envios e alcance
- **Cliques**: Rastreamento de cliques nos links
- **Histórico**: Lista detalhada de todos os envios

---

## Estrutura do Projeto

```
Divulgarzap/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Schema do banco de dados
│   ├── src/
│   │   ├── lib/
│   │   │   ├── prisma.js       # Cliente Prisma
│   │   │   └── redis.js        # Conexão Redis
│   │   ├── routes/
│   │   │   ├── ads.js          # CRUD de anúncios
│   │   │   ├── disparar.js     # Disparo de mensagens
│   │   │   ├── grupos.js       # Listagem de grupos
│   │   │   ├── metricas.js     # Métricas e histórico
│   │   │   ├── tracking.js     # Rastreamento de cliques
│   │   │   ├── upload.js       # Upload de imagens
│   │   │   └── whatsapp.js     # Controle do WhatsApp
│   │   ├── services/
│   │   │   └── whatsappService.js  # Serviço venom-bot
│   │   ├── workers/
│   │   │   └── sendWorker.js   # Worker BullMQ
│   │   └── server.js           # Servidor Express
│   ├── uploads/                # Imagens enviadas
│   ├── .env                    # Variáveis de ambiente
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── admin/
    │   │   │   └── page.tsx    # Painel admin (QR Code)
    │   │   ├── globals.css     # Estilos globais
    │   │   ├── layout.tsx      # Layout raiz
    │   │   └── page.tsx        # Página principal
    │   ├── components/
    │   │   ├── AdsTab.tsx      # Aba de anúncios
    │   │   ├── ClicksTab.tsx   # Aba de cliques
    │   │   ├── Header.tsx      # Cabeçalho
    │   │   ├── HistoryTab.tsx  # Aba de histórico
    │   │   ├── LoadingSpinner.tsx
    │   │   ├── OverviewTab.tsx # Aba visão geral
    │   │   ├── StatsCard.tsx   # Card de estatísticas
    │   │   ├── Tabs.tsx        # Navegação por abas
    │   │   ├── Toggle.tsx      # Componente toggle
    │   │   └── WhatsAppPreview.tsx  # Preview estilo WhatsApp
    │   └── lib/
    │       └── api.ts          # Cliente da API
    ├── .env.local
    ├── tailwind.config.js
    └── package.json
```

---

## API Endpoints

| Método | Rota                  | Descrição                    |
| ------ | --------------------- | ---------------------------- |
| POST   | /api/ads              | Criar anúncio                |
| GET    | /api/ads              | Listar anúncios              |
| GET    | /api/ads/:id          | Buscar anúncio por ID        |
| PUT    | /api/ads/:id          | Atualizar anúncio            |
| DELETE | /api/ads/:id          | Deletar anúncio              |
| POST   | /api/disparar         | Disparar mensagens           |
| GET    | /api/grupos           | Listar grupos do WhatsApp    |
| GET    | /api/metricas         | Obter métricas               |
| GET    | /api/metricas/historico | Histórico de envios        |
| POST   | /api/whatsapp/start   | Iniciar sessão WhatsApp      |
| GET    | /api/whatsapp/qrcode  | Obter QR Code                |
| GET    | /api/whatsapp/status  | Status da conexão            |
| POST   | /api/whatsapp/disconnect | Desconectar WhatsApp      |
| POST   | /api/upload           | Upload de imagem             |
| GET    | /r/:trackingId        | Redirect com rastreamento    |
