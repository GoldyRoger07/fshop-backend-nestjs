import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Refresh token opaque (SPEC §5.1).
 *
 * On ne stocke JAMAIS le token en clair : `tokenHash` = SHA-256 hex de la valeur
 * envoyée au client (cookie HttpOnly). Impossible de rejouer un token depuis un
 * dump de la base.
 *
 * `family` regroupe une chaîne de rotation : à chaque refresh, l'ancien token est
 * révoqué et un nouveau est émis dans la MÊME famille. Si un token déjà révoqué
 * est réutilisé → session compromise → on révoque toute la famille.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  @Index()
  userId!: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 36 })
  @Index()
  family!: string;

  @Column({ type: 'datetime' })
  expiresAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
