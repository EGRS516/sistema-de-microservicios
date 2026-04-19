import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(OrderStatus, {
    message: `status must be one of: ${Object.values(['PENDING', 'PAID', 'CANCELLED']).join(', ')}`,
  })
  status: OrderStatus;
}
