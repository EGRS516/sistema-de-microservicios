import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { 
  PaymentProcessedEvent, 
  PaymentStatus, 
  QUEUES, 
  EVENTS 
} from '../common';

@Processor(QUEUES.PAYMENT_EVENTS)
export class PaymentEventsWorker extends WorkerHost {
  private readonly logger = new Logger(PaymentEventsWorker.name);

  async process(job: Job<PaymentProcessedEvent>): Promise<void> {
    const { data } = job;

    if (job.name !== EVENTS.PAYMENT_PROCESSED) {
      this.logger.warn(`Trabajo desconocido: ${job.name}`);
      return;
    }

    const separator = '─'.repeat(52);
    const timestamp = new Date().toLocaleTimeString();

    if (data.status === PaymentStatus.SUCCESS) {
      this.logger.log(
        `\n📬 NOTIFICACIÓN  [${timestamp}]\n` +
        `${separator}\n` +
        `  Evento    : ${EVENTS.PAYMENT_PROCESSED}\n` +
        `  Estado    : ✅ ÉXITO\n` +
        `  Pedido    : ${data.orderId}\n` +
        `  Usuario   : ${data.userId}\n` +
        `  Monto     : $${data.amount.toFixed(2)}\n` +
        `  Ref       : ${data.stripePaymentId || data.paymentId}\n` +
        `  Mensaje   : "¡Tu pedido ha sido confirmado! 🚀 Ya vamos en camino."\n` +
        `${separator}`,
      );
    } else {
      this.logger.warn(
        `\n📬 NOTIFICACIÓN  [${timestamp}]\n` +
        `${separator}\n` +
        `  Evento    : ${EVENTS.PAYMENT_PROCESSED}\n` +
        `  Estado    : ❌ FALLIDO\n` +
        `  Pedido    : ${data.orderId}\n` +
        `  Usuario   : ${data.userId}\n` +
        `  Monto     : $${data.amount.toFixed(2)}\n` +
        `  Razón     : ${data.failureReason || 'Pago rechazado'}\n` +
        `  Mensaje   : "El pago falló. Por favor, actualiza tu método de pago."\n` +
        `${separator}`,
      );
    }
  }
}
