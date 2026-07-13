import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnée lue par le JwtAuthGuard global. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marque une route comme ouverte : le JwtAuthGuard global la laisse passer sans
 * exiger d'access token (catalogue public, login/register, etc.).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
