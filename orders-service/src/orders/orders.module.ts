import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { PaymentEventsWorker } from './payment-events.worker';
import { QUEUES } from '../common';

@Module({
  imports: [
    PrismaModule, 
    EventsModule,
    BullModule.registerQueue({ name: QUEUES.PAYMENT_EVENTS }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentEventsWorker],
})
export class OrdersModule {}
