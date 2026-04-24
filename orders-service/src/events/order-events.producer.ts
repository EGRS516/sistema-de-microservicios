import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OrderCreatedEvent, QUEUES, EVENTS } from '../common';

@Injectable()
export class OrderEventsProducer {
  private readonly logger = new Logger(OrderEventsProducer.name);

  constructor(
    @InjectQueue(QUEUES.ORDER_EVENTS) private readonly orderEventsQueue: Queue,
  ) {}

  async publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.orderEventsQueue.add(EVENTS.ORDER_CREATED, event, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.log(
      `📤 Event published: ${EVENTS.ORDER_CREATED} | orderId=${event.orderId} | total=$${event.total.toFixed(2)}`,
    );
  }
}
