import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  total: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('payment-events')
    private readonly paymentEventsQueue: Queue,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (stripeKey && stripeKey !== 'sk_test_placeholder') {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
      this.logger.log('✅ Stripe initialized in TEST mode');
    } else {
      this.stripe = null;
      this.logger.warn(
        '⚠️  STRIPE_SECRET_KEY not set — running in simulation mode (set key in payments-service/.env)',
      );
    }
  }

  async processPayment(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(
      `💳 Processing payment | orderId=${event.orderId} | amount=$${event.total.toFixed(2)}`,
    );

    let paymentStatus: PaymentStatus;
    let stripePaymentId: string | undefined;
    let failureReason: string | undefined;

    if (this.stripe) {
      // ── Real Stripe (Test Mode) ────────────────────────────────────
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
        this.logger.error(`❌ Stripe error: ${err.message}`);
      }
    } else {
      // ── Simulation Mode ────────────────────────────────────────────
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
        : 'Insufficient funds (simulated)';
      this.logger.log(`🎲 Simulated payment → ${paymentStatus}`);
    }

    // ── Persist payment record ─────────────────────────────────────
    const payment = await this.prisma.payment.upsert({
      where: { orderId: event.orderId },
      create: {
        orderId: event.orderId,
        amount: event.total,
        status: paymentStatus,
        stripePaymentId,
        failureReason,
      },
      update: { status: paymentStatus, stripePaymentId, failureReason },
    });

    // ── Update Order status via HTTP ───────────────────────────────
    const orderStatus =
      paymentStatus === PaymentStatus.SUCCESS ? 'PAID' : 'CANCELLED';

    const ordersUrl =
      process.env.ORDERS_SERVICE_URL || 'http://localhost:3001';

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(
          `${ordersUrl}/orders/${event.orderId}/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: orderStatus }),
            signal: controller.signal,
          },
        );

        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        this.logger.log(
          `🔄 Order ${event.orderId} status updated → ${orderStatus}`,
        );
        break;
      } catch (err: any) {
        this.logger.warn(
          `⚠️ Failed to update order status (attempt ${attempt}/${maxRetries}): ${err.message}`,
        );
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        } else {
          this.logger.error(
            `❌ Could not update order ${event.orderId} status after ${maxRetries} attempts`,
          );
        }
      }
    }

    // ── Publish payment.processed event ───────────────────────────
    await this.paymentEventsQueue.add(
      'payment.processed',
      {
        orderId: event.orderId,
        userId: event.userId,
        paymentId: payment.id,
        amount: event.total,
        status: paymentStatus,
        stripePaymentId,
        failureReason,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(
      `📤 Event published: payment.processed | orderId=${event.orderId} | status=${paymentStatus}`,
    );
  }
}
