import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentsService } from '../payments/payments.service';

@Processor('order-events')
export class OrderEventsWorker extends WorkerHost {
  private readonly logger = new Logger(OrderEventsWorker.name);

  constructor(private readonly paymentsService: PaymentsService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(
      `📥 Job received: ${job.name} | id=${job.id} | attempt=${job.attemptsMade + 1}`,
    );

    switch (job.name) {
      case 'order.created':
        await this.paymentsService.processPayment(job.data);
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
