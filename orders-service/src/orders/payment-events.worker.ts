import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrdersService } from './orders.service';
import { 
  PaymentProcessedEvent, 
  PaymentStatus, 
  OrderStatus, 
  QUEUES, 
  EVENTS 
} from '../common';

@Processor(QUEUES.PAYMENT_EVENTS)
export class PaymentEventsWorker extends WorkerHost {
  private readonly logger = new Logger(PaymentEventsWorker.name);

  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  async process(job: Job<PaymentProcessedEvent>): Promise<void> {
    if (job.name !== EVENTS.PAYMENT_PROCESSED) {
      this.logger.warn(`Nombre de trabajo desconocido: ${job.name}`);
      return;
    }

    const { orderId, status } = job.data;
    this.logger.log(`📥 Recibido ${job.name} | orderId=${orderId} | estado=${status}`);

    const newStatus = status === PaymentStatus.SUCCESS 
      ? OrderStatus.PAID 
      : OrderStatus.CANCELLED;

    try {
      await this.ordersService.updateStatus(orderId, newStatus as any);
      this.logger.log(`✅ Pedido ${orderId} actualizado a ${newStatus}`);
    } catch (error) {
      this.logger.error(`❌ Falló la actualización del pedido ${orderId}: ${error.message}`);
      throw error; // Reintentar trabajo
    }
  }
}
