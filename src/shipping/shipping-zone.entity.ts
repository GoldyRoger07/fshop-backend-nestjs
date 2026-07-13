import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer } from '../common/money';

/** Zone de livraison à tarif manuel (SPEC §12). Montant en centimes HTG. */
@Entity('shipping_zones')
export class ShippingZone {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'fee_cents', type: 'bigint', transformer: bigintTransformer })
  feeCents!: number;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export interface ShippingZoneView {
  id: number;
  name: string;
  feeCents: number;
  active: boolean;
}

export function toShippingZoneView(z: ShippingZone): ShippingZoneView {
  return { id: z.id, name: z.name, feeCents: z.feeCents, active: z.active };
}
