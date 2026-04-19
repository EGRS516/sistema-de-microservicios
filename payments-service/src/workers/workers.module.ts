import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderEventsWorker } from './order-events.worker';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    // Register the queue this worker consumes
    BullModule.registerQueue({ name: 'order-events' }),
    // Import PaymentsModule to get PaymentsService + payment-events queue
    PaymentsModule,
  ],
  providers: [OrderEventsWorker],
})
export class WorkersModule {}
