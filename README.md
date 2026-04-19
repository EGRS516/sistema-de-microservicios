# 🚀 Delivery App — Sistema de Microservicios

> NestJS · Redis (BullMQ) · PostgreSQL · Prisma · Docker · Stripe

## Arquitectura

```
Cliente (HTTP)
      │
      ▼
┌─────────────────┐
│   API Gateway   │  :3000  → Bull Board dashboard + reverse proxy
└────────┬────────┘
         │ HTTP (interno)
    ┌────┴───────────────────────┐
    │                            │
┌───▼──────┐          ┌──────────▼────┐
│  Orders  │          │   Payments    │
│ Service  │          │   Service     │
│  :3001   │          │   :3002       │
│ Postgres │          │   Postgres    │
└────┬─────┘          └──────┬────────┘
     │   Events via          │
     │   BullMQ / Redis      │
     └──────────┬────────────┘
                │
        ┌───────▼────────┐
        │     Redis      │  :6379  (BullMQ queues)
        └───────┬────────┘
                │
     ┌──────────▼──────────┐
     │  Notifications Svc  │  :3003  (consumer, no DB)
     └─────────────────────┘
```

### Flujo de eventos

```
POST /orders  →  Orders Service  →  [order.created] queue
                                           ↓
                               Payments Service (Stripe)
                                           ↓
                                  [payment.processed] queue
                                           ↓
                               Notifications Service (log)
```

## Inicio rápido

### 1. Clonar y configurar

```bash
cp .env.example payments-service/.env
# Editar STRIPE_SECRET_KEY (opcional — sin key usa modo simulación)
```

### 2. Levantar todo

```bash
docker compose up --build
```

Espera ~60 segundos a que todas las migraciones y builds terminen.

## Endpoints

| Método | URL | Descripción |
|--------|-----|-------------|
| `POST` | `http://localhost:3000/orders` | Crear pedido |
| `GET`  | `http://localhost:3000/orders` | Listar pedidos |
| `GET`  | `http://localhost:3000/orders/:id` | Ver pedido |
| `GET`  | `http://localhost:3000/admin/queues` | Bull Board dashboard |

## Prueba completa (cURL)

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "items": [
      { "productId": "p-001", "name": "Burger Deluxe", "quantity": 2, "price": 12.50 },
      { "productId": "p-002", "name": "Large Fries",   "quantity": 1, "price": 4.00 }
    ]
  }'
```

Observa los logs de los 3 servicios:
```bash
docker compose logs -f orders-service payments-service notifications-service
```

## Stripe (modo test)

1. Ve a https://dashboard.stripe.com/test/apikeys
2. Copia tu **Secret key** (empieza con `sk_test_...`)
3. Agrégala en `payments-service/.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_TU_KEY_AQUI
   ```
4. Rebuild: `docker compose up --build payments-service`

Sin key → modo simulación (90% éxito, 10% fallo aleatorio).

## Dashboard de colas

📊 **Bull Board** → http://localhost:3000/admin/queues

Visualiza jobs, reintentos, dead-letter queue en tiempo real.

## Tecnologías

| Tecnología | Uso |
|-----------|-----|
| **NestJS** | Framework para cada microservicio |
| **BullMQ** | Message queue sobre Redis (reintentos, backoff exponencial) |
| **Redis** | Broker de mensajes compartido |
| **PostgreSQL** | Persistencia (DB separada por servicio) |
| **Prisma** | ORM + migraciones |
| **Stripe** | Procesamiento de pagos (modo test) |
| **Docker Compose** | Orquestación local |

## Patrones implementados

- ✅ **Event-driven architecture** — servicios desacoplados via BullMQ
- ✅ **API Gateway** — punto de entrada único
- ✅ **Correlation IDs** — trazabilidad cross-service (`x-request-id` header)
- ✅ **Retry con backoff exponencial** — 3 reintentos automáticos por job
- ✅ **Dead-letter queues** — jobs fallidos preservados para inspección
- ✅ **Graceful shutdown** — NestJS drena jobs en vuelo antes de parar
- ✅ **DB por servicio** — aislamiento de datos (Orders DB ≠ Payments DB)
- ✅ **Health checks** — Docker espera a que Postgres y Redis estén listos

## 🧪 Pruebas y Validación

El sistema incluye scripts para validar el funcionamiento y la resistencia del sistema.

### 1. Test de Integración E2E
Verifica el flujo completo: Gateway ➔ Orders ➔ Redis ➔ Payments ➔ Notificaciones.
```bash
node tests/e2e/flow-test.js
```

### 2. Test de Carga (Stress Test)
Simula una carga masiva de **100 pedidos por segundo** durante 10 segundos para evaluar el rendimiento.
```bash
node tests/load/stress-test.js
```
