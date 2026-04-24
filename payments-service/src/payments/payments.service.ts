import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus as PrismaPaymentStatus } from '@prisma/client';
import { 
  OrderCreatedEvent, 
  PaymentProcessedEvent, 
  PaymentStatus, 
  QUEUES, 
  EVENTS 
} from '../common';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.PAYMENT_EVENTS)
    private readonly paymentEventsQueue: Queue,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (stripeKey && stripeKey !== 'sk_test_placeholder') {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
      this.logger.log('✅ Stripe inicializado en modo TEST');
    } else {
      this.stripe = null;
      this.logger.warn(
        '⚠️  STRIPE_SECRET_KEY no configurada — ejecutando en modo simulación (configura la clave en payments-service/.env)',
      );
    }
  }

  async processPayment(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(
      `💳 Procesando pago | orderId=${event.orderId} | monto=$${event.total.toFixed(2)}`,
    );

    let paymentStatus: PaymentStatus;
    let stripePaymentId: string | undefined;
    let failureReason: string | undefined;

    if (this.stripe) {
      try {
        const amountInCents = Math.round(event.total * 100);

        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: amountInCents,
          currency: 'usd',
          payment_method: 'pm_card_visa',
          confirm: true,
          return_url: 'http://localhost:3000',
          metadata: {
            orderId: event.orderId,
            userId: event.userId,
          },
        });

        stripePaymentId = paymentIntent.id;
        paymentStatus =
          paymentIntent.status === 'succeeded'
            ? PaymentStatus.SUCCESS
            : PaymentStatus.FAILED;

        this.logger.log(
          `✅ Stripe PaymentIntent ${paymentIntent.id} → ${paymentIntent.status}`,
        );
      } catch (err: any) {
        paymentStatus = PaymentStatus.FAILED;
        failureReason = err.message;
        this.logger.error(`❌ Error de Stripe: ${err.message}`);
      }
    } else {
      // ── Modo Simulación ────────────────────────────────────────────
      await new Promise((resolve) =>
        setTimeout(resolve, 400 + Math.random() * 300),
      );
      const success = Math.random() > 0.1;
      paymentStatus = success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
      stripePaymentId = success
        ? `sim_pi_${event.orderId.slice(0, 8)}`
        : undefined;
      failureReason = success
        ? undefined
        : 'Fondos insuficientes (simulado)';
      this.logger.log(`🎲 Pago simulado → ${paymentStatus}`);
    }

    // ── Persistir registro de pago ─────────────────────────────────
    const payment = await this.prisma.payment.upsert({
      where: { orderId: event.orderId },
      create: {
        orderId: event.orderId,
        amount: event.total,
        status: paymentStatus as PrismaPaymentStatus,
        stripePaymentId,
        failureReason,
      },
      update: { 
        status: paymentStatus as PrismaPaymentStatus, 
        stripePaymentId, 
        failureReason 
      },
    });

    // ── Publicar evento payment.processed ──────────────────────────
    // Este evento será consumido por AMBOS: Servicio de Pedidos (para actualizar estado)
    // y Servicio de Notificaciones (para avisar al usuario).
    const eventPayload: PaymentProcessedEvent = {
      orderId: event.orderId,
      userId: event.userId,
      paymentId: payment.id,
      amount: event.total,
      status: paymentStatus,
      stripePaymentId,
      failureReason,
    };

    await this.paymentEventsQueue.add(
      EVENTS.PAYMENT_PROCESSED,
      eventPayload,
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(
      `📤 Evento publicado: ${EVENTS.PAYMENT_PROCESSED} | orderId=${event.orderId} | estado=${paymentStatus}`,
    );
  }
}
