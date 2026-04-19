import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentEventsWorker } from './payment-events.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'payment-events' }),
  ],
  providers: [PaymentEventsWorker],
})
export class WorkersModule {}