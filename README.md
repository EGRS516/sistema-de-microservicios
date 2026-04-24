# 🚀 Delivery App — Sistema de Microservicios

> NestJS · Redis (BullMQ) · PostgreSQL · Prisma · Docker · Stripe

Este proyecto es una arquitectura de microservicios diseñada para manejar el flujo de un pedido de entrega de comida, desde la creación hasta la notificación final, utilizando un enfoque **100% orientado a eventos**.

## Arquitectura

```
Cliente (HTTP)
      │
      ▼
┌─────────────────┐
│   API Gateway   │  :3000  → Bull Board dashboard + reverse proxy
└────────┬────────┘
         │ HTTP (interno)
    ┌────┴───────────────────────────┐
    │                                │
┌───▼──────┐           ┌─────────────▼────┐
│  Pedidos │           │      Pagos       │
│ Service  │           │     Service      │
│  :3001   │           │      :3002       │
│ Postgres │           │     Postgres     │
└────┬─────┘           └──────┬───────────┘
     ▲                        │
     │      Eventos vía       │
     │     BullMQ / Redis     │
     └──────────┬─────────────┘
                │
        ┌───────▼────────┐
        │     Redis      │  :6379  (BullMQ queues)
        └───────┬────────┘
                │
     ┌──────────▼──────────┐
     │  Notificaciones Svc │  :3003  (consumidor, sin DB)
     └─────────────────────┘
```

### Flujo de eventos (Ciclo Completo)

1. **POST /orders** → El servicio de **Pedidos** crea el registro (`PENDING`) y publica `order.created`.
2. **Cola order-events** → El servicio de **Pagos** consume el evento y procesa el cobro (Stripe o Simulación).
3. **Cola payment-events** → El servicio de **Pagos** publica `payment.processed`.
4. **Consumidores en paralelo**:
   - El servicio de **Pedidos** actualiza el estado a `PAID` o `CANCELLED`.
   - El servicio de **Notificaciones** registra/envía el aviso al usuario.

## Estructura del Proyecto

El proyecto utiliza una carpeta compartida para mantener la consistencia de tipos:

- `/common`: Contiene definiciones compartidas, enums de estado y nombres de eventos. Se inyecta en cada microservicio durante la construcción de Docker.
- `/api-gateway`: Punto de entrada único y dashboard de colas.
- `/orders-service`: Gestión de pedidos y estados.
- `/payments-service`: Procesamiento de pagos y pasarela Stripe.
- `/notifications-service`: Servicio de mensería y logs de usuario.

## Inicio rápido

### 1. Configurar variables de entorno
```bash
cp .env.example payments-service/.env
# Editar STRIPE_SECRET_KEY en payments-service/.env si deseas usar Stripe real
```

### 2. Levantar la infraestructura
```bash
docker compose up --build
```
*Nota: El sistema utiliza `prisma db push` automáticamente para sincronizar los esquemas sin necesidad de migraciones manuales en desarrollo.*

## Endpoints Principales

| Método | URL | Descripción |
|--------|-----|-------------|
| `POST` | `http://localhost:3000/orders` | Crear un nuevo pedido |
| `GET`  | `http://localhost:3000/orders` | Listar todos los pedidos |
| `GET`  | `http://localhost:3000/orders/:id` | Ver detalles de un pedido |
| `GET`  | `http://localhost:3000/admin/queues` | Dashboard de Bull Board |

## Prueba de Flujo Completo (cURL)

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

## Patrones implementados

- ✅ **Event-driven architecture** — Desacoplamiento total mediante BullMQ.
- ✅ **API Gateway** — Proxy inverso y agregación de dashboards.
- ✅ **Shared Common Module** — Fuente única de verdad para tipos y constantes.
- ✅ **Correlation IDs** — Trazabilidad completa con `x-request-id`.
- ✅ **Retry con backoff exponencial** — Reintentos automáticos en fallos de red.
- ✅ **Dead-letter queues** — Gestión de trabajos fallidos para inspección manual.
- ✅ **Multi-stage Docker builds** — Imágenes optimizadas y ligeras para producción.
- ✅ **DB por servicio** — Aislamiento de datos (Pedidos DB ≠ Pagos DB).
- ✅ **Health checks** — Docker espera a que Postgres y Redis estén listos.

## 🧪 Pruebas y Validación

### 1. Test de Integración E2E
Verifica el flujo circular completo:
```bash
node tests/e2e/flow-test.js
```

### 2. Test de Carga (Stress Test)
Simula una carga masiva para evaluar el rendimiento de las colas:
```bash
node tests/load/stress-test.js
```
