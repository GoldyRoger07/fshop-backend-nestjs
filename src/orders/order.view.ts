import { Order, OrderItem, OrderStatus } from './entities/order.entity';

export interface OrderItemView {
  id: number;
  productId: number;
  variantId: number;
  slug: string;
  nameSnapshot: string;
  optionSummary: string | null;
  unitPriceCentsSnapshot: number;
  qty: number;
  lineTotalCents: number;
}

export interface OrderView {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  customerName: string;
  customerEmail: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  shippingAddress: Order['shippingAddress'];
  items: OrderItemView[];
  createdAt: string;
}

function toItemView(i: OrderItem): OrderItemView {
  return {
    id: i.id,
    productId: i.productId,
    variantId: i.productId, // produit simple : variante par défaut
    slug: i.slug,
    nameSnapshot: i.nameSnapshot,
    optionSummary: null,
    unitPriceCentsSnapshot: i.unitPriceCentsSnapshot,
    qty: i.qty,
    lineTotalCents: i.lineTotalCents,
  };
}

export function toOrderView(o: Order): OrderView {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    subtotalCents: o.subtotalCents,
    shippingCents: o.shippingCents,
    totalCents: o.totalCents,
    shippingAddress: o.shippingAddress,
    items: (o.items ?? []).map(toItemView),
    createdAt: (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)).toISOString(),
  };
}

/**
 * Transitions de statut autorisées (SPEC §11 ; miroir de ORDER_STATUS_META du
 * front). Toute transition hors table → 409.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.REFUNDED],
  [OrderStatus.REFUNDED]: [],
};
