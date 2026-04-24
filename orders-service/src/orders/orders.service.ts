import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderEventsProducer } from '../events/order-events.producer';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus as PrismaOrderStatus } from '@prisma/client';
import { OrderStatus } from '../common';

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
        status: OrderStatus.PENDING as any,
      },
    });

    this.logger.log(
      `✅ Pedido creado | id=${order.id} | userId=${order.userId} | total=$${total.toFixed(2)}`,
    );

    // Disparar evento asíncrono — el servicio de pagos lo recogerá de la cola
    try {
      await this.eventsProducer.publishOrderCreated({
        orderId: order.id,
        userId: order.userId,
        total: order.total,
        items: dto.items,
      });
    } catch (error) {
      this.logger.error(
        `❌ Error al publicar evento order.created para el pedido ${order.id}: ${error.message}`,
      );
      // El pedido ya está persistido. En un sistema de producción real, 
      // se usaría un Patrón Outbox para asegurar la consistencia eventual.
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
    if (!order) throw new NotFoundException(`Pedido ${id} no encontrado`);
    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException(`Pedido ${id} no encontrado`);

    this.logger.log(`🔄 Actualizando estado del pedido ${id} → ${status}`);
    return this.prisma.order.update({
      where: { id },
      data: { status: status as unknown as PrismaOrderStatus },
    });
  }
}
