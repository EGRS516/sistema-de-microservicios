# ─── Stage 1: Build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl

WORKDIR /app

# Copy shared definitions first
COPY common ./common

# Copy service-specific files
COPY orders-service/package*.json ./orders-service/
WORKDIR /app/orders-service
RUN npm install

COPY orders-service/ .
# Inject common files into src for easy importing if needed, 
# or just rely on tsconfig. For simplicity in Docker, we copy it to a known path.
RUN mkdir -p src/common && cp ../common/* src/common/

RUN npx prisma generate
RUN npm run build
RUN npm prune --production

# ─── Stage 2: Production ───────────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/orders-service/dist ./dist
COPY --from=builder /app/orders-service/node_modules ./node_modules
COPY --from=builder /app/orders-service/prisma ./prisma
COPY --from=builder /app/orders-service/package*.json ./

EXPOSE 3001

# prisma db push is used here for simplicity in a demo/dev environment.
# In a real production CI/CD, you should use 'prisma migrate deploy'.
CMD ["sh", "-c", "npx prisma db push && node dist/main"]
