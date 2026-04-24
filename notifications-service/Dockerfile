# ─── Stage 1: Build ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared definitions first
COPY common ./common

# Copy service-specific files
COPY notifications-service/package*.json ./notifications-service/
WORKDIR /app/notifications-service
RUN npm install

COPY notifications-service/ .
RUN mkdir -p src/common && cp ../common/* src/common/

RUN npm run build
RUN npm prune --production

# ─── Stage 2: Production ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/notifications-service/dist ./dist
COPY --from=builder /app/notifications-service/node_modules ./node_modules
COPY --from=builder /app/notifications-service/package*.json ./

EXPOSE 3003

CMD ["node", "dist/main"]
