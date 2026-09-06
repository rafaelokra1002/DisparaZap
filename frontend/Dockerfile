# ---- DisparaZap frontend (Next.js 14) ----
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

# NEXT_PUBLIC_* é embutido no bundle em BUILD TIME.
# Passe a URL pública do backend como build-arg (ex.: https://api.seudominio.com).
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copia apenas o necessário para rodar `next start`.
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 3000
# Porta 3000 explicita (o package.json usa -p 3003, mas o compose/dominio espera 3000).
CMD ["npx", "next", "start", "-p", "3000"]
