import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  total: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

@Injectable()
export class OrderEventsProducer {
  private readonly logger = new Logger(OrderEventsProducer.name);

  constructor(
    @InjectQueue('order-events') private readonly orderEventsQueue: Queue,
  ) {}

  async publishOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.orderEventsQueue.add('order.created', event, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.log(
      `📤 Event published: order.created | orderId=${event.orderId} | total=$${event.total.toFixed(2)}`,
    );
  }
}
