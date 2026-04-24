import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentEventsWorker } from './payment-events.worker';
import { QUEUES } from '../common';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.PAYMENT_EVENTS }),
  ],
  providers: [PaymentEventsWorker],
})
export class WorkersModule {}