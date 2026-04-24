import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { v4 as uuidv4 } from 'uuid';
import { QUEUES } from './common';

async function bootstrap() {
  // Deshabilitar body-parser para que los cuerpos originales pasen a los servicios proxied
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const expressApp = app.getHttpAdapter().getInstance();

  // ── Middleware de Correlation ID ───────────────────────────────────
  expressApp.use((req: any, res: any, next: any) => {
    req.headers['x-request-id'] =
      req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.headers['x-request-id']);
    next();
  });

  // ── Dashboard de Bull Board ────────────────────────────────────────
  const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(
        new Queue(QUEUES.ORDER_EVENTS, { connection: redisConnection }),
      ),
      new BullMQAdapter(
        new Queue(QUEUES.PAYMENT_EVENTS, { connection: redisConnection }),
      ),
    ] as any[],
    serverAdapter,
  });

  expressApp.use('/admin/queues', serverAdapter.getRouter());

  // ── Rutas de Reverse Proxy ─────────────────────────────────────────
  const ordersTarget =
    process.env.ORDERS_SERVICE_URL || 'http://localhost:3001';

  // Solo el servicio de Pedidos (Orders) tiene API HTTP externa
  expressApp.use(
    '/orders',
    createProxyMiddleware({
      target: ordersTarget,
      changeOrigin: true,
      onError: (err: any, _req: any, res: any) => {
        res.status(502).json({
          error: 'Servicio de Pedidos no disponible',
          details: err.message,
        });
      },
    }),
  );

  // ── Health check de la raíz ────────────────────────────────────────
  expressApp.get('/', (_req: any, res: any) => {
    res.json({
      service: 'API Gateway',
      status: 'healthy',
      routes: {
        orders: `${ordersTarget}/orders`,
        bullBoard: '/admin/queues',
      },
    });
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n🚀 API Gateway listo`);
  console.log(`   http://localhost:${port}`);
  console.log(`   📊 Bull Board → http://localhost:${port}/admin/queues`);
  console.log(`   🛒 Pedidos    → ${ordersTarget}\n`);
}

bootstrap();
