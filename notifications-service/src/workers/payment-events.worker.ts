import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

interface PaymentProcessedEvent {
  orderId: string;
  userId: string;
  paymentId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
  stripePaymentId?: string;
  failureReason?: string;
}

@Processor('payment-events')
export class PaymentEventsWorker extends WorkerHost {
  private readonly logger = new Logger(PaymentEventsWorker.name);

  async process(job: Job<PaymentProcessedEvent>): Promise<void> {
    const { data } = job;

    if (job.name !== 'payment.processed') {
      this.logger.warn(`Unknown job: ${job.name}`);
      return;
    }

    const separator = '─'.repeat(52);
    const timestamp = new Date().toLocaleTimeString();

    if (data.status === 'SUCCESS') {
      this.logger.log(
        `\n📬 NOTIFICATION  [${timestamp}]\n` +
        `${separator}\n` +
        `  Event     : payment.processed\n` +
        `  Status    : ✅ SUCCESS\n` +
        `  Order     : ${data.orderId}\n` +
        `  User      : ${data.userId}\n` +
        `  Amount    : $${data.amount.toFixed(2)}\n` +
        `  Ref       : ${data.stripePaymentId || data.paymentId}\n` +
        `  Message   : "Your delivery is confirmed! 🚀 We're on our way."\n` +
        `${separator}`,
      );
    } else {
      this.logger.warn(
        `\n📬 NOTIFICATION  [${timestamp}]\n` +
        `${separator}\n` +
        `  Event     : payment.processed\n` +
        `  Status    : ❌ FAILED\n` +
        `  Order     : ${data.orderId}\n` +
        `  User      : ${data.userId}\n` +
        `  Amount    : $${data.amount.toFixed(2)}\n` +
        `  Reason    : ${data.failureReason || 'Payment declined'}\n` +
        `  Message   : "Payment failed. Please update your payment method."\n` +
        `${separator}`,
      );
    }
  }
}
