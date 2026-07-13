import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';

/**
 * Convertit une durée type "7d" / "15m" / "3600s" en millisecondes.
 * Sert à calculer `expiresAt` du refresh token et le `maxAge` du cookie.
 */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Durée invalide: "${value}" (attendu ex. "7d", "15m")`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return amount * factor;
}

export interface IssuedRefreshToken {
  /** Valeur opaque en clair — à envoyer au client, jamais persistée telle quelle. */
  token: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenService {
  private readonly ttlMs: number;

  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
    config: ConfigService,
  ) {
    this.ttlMs = parseDurationMs(
      config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Émet un nouveau refresh token. `family` est réutilisé lors d'une rotation,
   * ou généré si c'est une nouvelle session (login/register).
   */
  async issue(user: User, family?: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + this.ttlMs);

    const entity = this.repo.create({
      userId: user.id,
      tokenHash: this.hash(token),
      family: family ?? randomUUID(),
      expiresAt,
      revokedAt: null,
    });
    await this.repo.save(entity);

    return { token, expiresAt };
  }

  /**
   * Valide + fait tourner un refresh token présenté par le client.
   * Détecte la réutilisation d'un token déjà révoqué → révoque toute la famille
   * (session compromise). Retourne le userId + le nouveau token émis.
   */
  async rotate(presentedToken: string): Promise<{ userId: number } & IssuedRefreshToken> {
    const tokenHash = this.hash(presentedToken);
    const existing = await this.repo.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    // Token inconnu : rien à révoquer, on ne fuite aucune info.
    if (!existing) {
      throw new UnauthorizedException('Refresh token invalide');
    }

    // Token déjà révoqué → réutilisation suspecte : on brûle toute la famille.
    if (existing.revokedAt) {
      await this.revokeFamily(existing.family);
      throw new UnauthorizedException('Refresh token invalide');
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expiré');
    }

    if (!existing.user || !existing.user.isActive) {
      throw new UnauthorizedException('Compte indisponible');
    }

    // Rotation : on révoque l'ancien et on émet un nouveau dans la même famille.
    existing.revokedAt = new Date();
    await this.repo.save(existing);

    const issued = await this.issue(existing.user, existing.family);
    return { userId: existing.userId, ...issued };
  }

  /** Révoque le token courant (logout d'une session). No-op si absent. */
  async revoke(presentedToken: string): Promise<void> {
    await this.repo.update(
      { tokenHash: this.hash(presentedToken) },
      { revokedAt: new Date() },
    );
  }

  /** Révoque toutes les sessions d'un utilisateur (logout-all). */
  async revokeAllForUser(userId: number): Promise<void> {
    await this.repo.update({ userId }, { revokedAt: new Date() });
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.repo.update({ family }, { revokedAt: new Date() });
  }
}
