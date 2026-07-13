import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Product } from '../products/entities/product.entity';

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Avis achat-vérifié + modération admin (SPEC §13). */
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  @Index()
  productId!: number;

  @Column()
  userId!: number;

  @Column({ name: 'user_name', type: 'varchar', length: 150 })
  userName!: string;

  @Column({ name: 'order_id' })
  orderId!: number;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'varchar', length: 150 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  @Index()
  status!: ReviewStatus;

  @CreateDateColumn()
  createdAt!: Date;
}

export interface ReviewView {
  id: number;
  productId: number;
  productName: string;
  userName: string;
  orderId: number;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  createdAt: string;
}

export function toReviewView(r: Review): ReviewView {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product?.name ?? '',
    userName: r.userName,
    orderId: r.orderId,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
  };
}
