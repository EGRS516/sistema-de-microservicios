# ─── Stage 1: Build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl

WORKDIR /app

# Copy shared definitions first
COPY common ./common

# Copy service-specific files
COPY payments-service/package*.json ./payments-service/
WORKDIR /app/payments-service
RUN npm install

COPY payments-service/ .
RUN mkdir -p src/common && cp ../common/* src/common/

RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# ─── Stage 2: Production ───────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/payments-service/dist ./dist
COPY --from=builder /app/payments-service/node_modules ./node_modules
COPY --from=builder /app/payments-service/prisma ./prisma
COPY --from=builder /app/payments-service/package*.json ./

EXPOSE 3002

# prisma db push is used here for simplicity in a demo/dev environment.
# In a real production CI/CD, you should use 'prisma migrate deploy'.
CMD ["sh", "-c", "npx prisma db push && node dist/main"]
