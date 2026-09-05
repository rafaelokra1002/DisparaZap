# ---- DisparaZap backend (Express + whatsapp-web.js/Puppeteer) ----
FROM node:20-slim

# Chromium + libs que o Puppeteer precisa, git (dep do whatsapp-web.js vem do GitHub),
# openssl/ca-certificates (Prisma) e dumb-init (PID 1 correto p/ matar o Chrome).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      git \
      openssl \
      ca-certificates \
      dumb-init \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
      libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Usa o Chromium do sistema; não baixa o do Puppeteer no npm install.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=3001

WORKDIR /app

# Instala dependências (inclui prisma). Cache-friendly.
COPY package*.json ./
RUN npm install --omit=dev

# Gera o Prisma Client (precisa do schema).
COPY prisma ./prisma
RUN npx prisma generate

# Código da aplicação.
COPY . .

# Pastas persistentes (montadas como volumes em produção).
RUN mkdir -p tokens uploads .wwebjs_cache

EXPOSE 3001

# Aplica migrações e sobe o servidor. dumb-init garante que o Chrome
# headless seja encerrado corretamente (evita zumbis).
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
