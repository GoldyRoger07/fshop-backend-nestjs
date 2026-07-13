import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { bigintTransformer } from '../../common/money';

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

/** Adresse figée au moment de la commande (SPEC §4.3), stockée en JSON. */
export interface ShippingAddressSnapshot {
  fullName: string;
  phone: string;
  zoneName: string;
  line1: string;
  line2?: string;
  city: string;
  notes?: string;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'order_number', type: 'varchar', length: 40, unique: true })
  orderNumber!: string;

  @Column()
  @Index()
  userId!: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT })
  status!: OrderStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus!: PaymentStatus;

  @Column({ name: 'payment_reference', type: 'varchar', length: 80, nullable: true })
  paymentReference!: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string;

  @Column({ name: 'customer_email', type: 'varchar', length: 255 })
  customerEmail!: string;

  @Column({ name: 'subtotal_cents', type: 'bigint', transformer: bigintTransformer })
  subtotalCents!: number;

  @Column({ name: 'shipping_cents', type: 'bigint', transformer: bigintTransformer })
  shippingCents!: number;

  @Column({ name: 'total_cents', type: 'bigint', transformer: bigintTransformer })
  totalCents!: number;

  @Column({ name: 'shipping_address', type: 'json' })
  shippingAddress!: ShippingAddressSnapshot;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Order, (order) => order.items, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'order_id' })
  orderId!: number;

  @Column({ name: 'product_id' })
  productId!: number;

  @Column({ type: 'varchar', length: 220 })
  slug!: string;

  @Column({ name: 'name_snapshot', type: 'varchar', length: 200 })
  nameSnapshot!: string;

  @Column({ name: 'unit_price_cents_snapshot', type: 'bigint', transformer: bigintTransformer })
  unitPriceCentsSnapshot!: number;

  @Column({ type: 'int' })
  qty!: number;

  @Column({ name: 'line_total_cents', type: 'bigint', transformer: bigintTransformer })
  lineTotalCents!: number;
}
