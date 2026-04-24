# ─── Stage 1: Build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared definitions first
COPY common ./common

# Copy service-specific files
COPY api-gateway/package*.json ./api-gateway/
WORKDIR /app/api-gateway
RUN npm install

COPY api-gateway/ .
RUN mkdir -p src/common && cp ../common/* src/common/

RUN npm run build
RUN npm prune --production

# ─── Stage 2: Production ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/api-gateway/dist ./dist
COPY --from=builder /app/api-gateway/node_modules ./node_modules
COPY --from=builder /app/api-gateway/package*.json ./

EXPOSE 3000

CMD ["node", "dist/main"]
