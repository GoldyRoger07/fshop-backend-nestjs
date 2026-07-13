import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Order } from '../orders/entities/order.entity';

export enum ReturnStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REFUNDED = 'REFUNDED',
}

/** Demande de retour / remboursement (SPEC §11). Traitement manuel admin. */
@Entity('return_requests')
export class ReturnRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'order_id' })
  @Index()
  orderId!: number;

  @Column({ name: 'order_number', type: 'varchar', length: 40 })
  orderNumber!: string;

  @Column({ name: 'order_item_id', type: 'int', nullable: true })
  orderItemId!: number | null;

  @Column({ name: 'item_name', type: 'varchar', length: 200, nullable: true })
  itemName!: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'enum', enum: ReturnStatus, default: ReturnStatus.REQUESTED })
  @Index()
  status!: ReturnStatus;

  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}

export interface ReturnRequestView {
  id: number;
  orderId: number;
  orderNumber: string;
  orderItemId: number | null;
  itemName: string | null;
  customerName: string;
  reason: string;
  status: ReturnStatus;
  adminNote: string | null;
  createdAt: string;
}

export function toReturnView(r: ReturnRequest): ReturnRequestView {
  return {
    id: r.id,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    orderItemId: r.orderItemId,
    itemName: r.itemName,
    customerName: r.customerName,
    reason: r.reason,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
  };
}
