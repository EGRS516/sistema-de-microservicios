import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderEventsProducer } from '../events/order-events.producer';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsProducer: OrderEventsProducer,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const total = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const order = await this.prisma.order.create({
      data: {
        userId: dto.userId,
        items: dto.items as any,
        total,
        status: OrderStatus.PENDING,
      },
    });

    this.logger.log(
      `✅ Order created | id=${order.id} | userId=${order.userId} | total=$${total.toFixed(2)}`,
    );

    // Fire async event — payments service will pick this up from the queue
    try {
      await this.eventsProducer.publishOrderCreated({
        orderId: order.id,
        userId: order.userId,
        total: order.total,
        items: dto.items,
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to publish order.created event for order ${order.id}: ${error.message}`,
      );
      // Order is already persisted, so we don't throw — but log the failure
      // In production, you'd want a retry mechanism or outbox pattern here
    }

    return order;
  }

  async findAll() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Order ${id} not found`);

    this.logger.log(`🔄 Updating order ${id} status → ${status}`);
    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }
}
