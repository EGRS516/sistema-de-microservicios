import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderEventsProducer } from './order-events.producer';

@Module({
  imports: [BullModule.registerQueue({ name: 'order-events' })],
  providers: [OrderEventsProducer],
  exports: [OrderEventsProducer],
})
export class EventsModule {}
