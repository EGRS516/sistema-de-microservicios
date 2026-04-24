export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

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

export interface PaymentProcessedEvent {
  orderId: string;
  userId: string;
  paymentId: string;
  amount: number;
  status: PaymentStatus;
  stripePaymentId?: string;
  failureReason?: string;
}

export const QUEUES = {
  ORDER_EVENTS: 'order-events',
  PAYMENT_EVENTS: 'payment-events',
};

export const EVENTS = {
  ORDER_CREATED: 'order.created',
  PAYMENT_PROCESSED: 'payment.processed',
};
