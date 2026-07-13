import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { Product } from '../products/entities/product.entity';

/**
 * Ligne de panier serveur, liée au compte (SPEC §7). Le prix n'est jamais figé :
 * il est recalculé au prix courant à chaque lecture. Produit simple → une ligne
 * par produit (unicité user+produit ; ré-ajouter incrémente la quantité).
 */
@Entity('cart_items')
@Unique(['userId', 'productId'])
export class CartItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @Index()
  userId!: number;

  @ManyToOne(() => Product, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({ name: 'product_id' })
  productId!: number;

  @Column({ type: 'int' })
  qty!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
