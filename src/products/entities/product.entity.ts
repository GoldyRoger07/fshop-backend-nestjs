import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Category } from '../../categories/category.entity';
import { bigintTransformer } from '../../common/money';

/**
 * Produit **simple** (décision MVP) : prix/stock à plat. Il est exposé au front
 * comme un produit à « variante par défaut » unique (variantId = product.id),
 * conformément à la « vue produit uniforme » de la SPEC §6.
 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 200 })
  @Index()
  name!: string;

  @Column({ length: 220, unique: true })
  slug!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  // Prix en centimes de HTG (SPEC §4.1), BIGINT.
  @Column({ name: 'price_cents', type: 'bigint', transformer: bigintTransformer })
  priceCents!: number;

  @Column({ default: 0 })
  stock!: number;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  // Mise en avant sur la page d'accueil (GET /products/featured).
  @Column({ default: false })
  featured!: boolean;

  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: Category;

  @Column({ name: 'category_id' })
  categoryId!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
