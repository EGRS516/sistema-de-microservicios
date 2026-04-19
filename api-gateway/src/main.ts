import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { v4 as uuidv4 } from 'uuid';

async function bootstrap() {
  // Disable body-parser so raw bodies pass through to proxied services
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const expressApp = app.getHttpAdapter().getInstance();

  // ── Correlation ID Middleware ──────────────────────────────────────
  expressApp.use((req: any, res: any, next: any) => {
    req.headers['x-request-id'] =
      req.headers['x-request-id'] || uuidv4();
    res.setHeader('x-request-id', req.headers['x-request-id']);
    next();
  });

  // ── Bull Board Dashboard ───────────────────────────────────────────
  const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(
        new Queue('order-events', { connection: redisConnection }),
      ),
      new BullMQAdapter(
        new Queue('payment-events', { connection: redisConnection }),
      ),
    ] as any[],
    serverAdapter,
  });

  expressApp.use('/admin/queues', serverAdapter.getRouter());

  // ── Reverse Proxy Routes ───────────────────────────────────────────
  const ordersTarget =
    process.env.ORDERS_SERVICE_URL || 'http://localhost:3001';
  const paymentsTarget =
    process.env.PAYMENTS_SERVICE_URL || 'http://localhost:3002';

  expressApp.use(
    '/orders',
    createProxyMiddleware({
      target: ordersTarget,
      changeOrigin: true,
      onError: (err: any, _req: any, res: any) => {
        res.status(502).json({
          error: 'Orders service unavailable',
          details: err.message,
        });
      },
    }),
  );

  expressApp.use(
    '/payments',
    createProxyMiddleware({
      target: paymentsTarget,
      changeOrigin: true,
      onError: (err: any, _req: any, res: any) => {
        res.status(502).json({
          error: 'Payments service unavailable',
          details: err.message,
        });
      },
    }),
  );

  // ── Root health check ──────────────────────────────────────────────
  expressApp.get('/', (_req: any, res: any) => {
    res.json({
      service: 'API Gateway',
      status: 'healthy',
      routes: {
        orders: `${ordersTarget}/orders`,
        payments: `${paymentsTarget}/payments`,
        bullBoard: '/admin/queues',
      },
    });
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`\n🚀 API Gateway ready`);
  console.log(`   http://localhost:${port}`);
  console.log(`   📊 Bull Board → http://localhost:${port}/admin/queues`);
  console.log(`   🛒 Orders    → ${ordersTarget}`);
  console.log(`   💳 Payments  → ${paymentsTarget}\n`);
}

bootstrap();
