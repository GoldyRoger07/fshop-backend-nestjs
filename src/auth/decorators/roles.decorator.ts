import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

/** Clé de métadonnée lue par le RolesGuard global. */
export const ROLES_KEY = 'roles';

/**
 * Restreint une route à un ou plusieurs rôles (RBAC).
 * Ex. `@Roles(UserRole.ADMIN)` sur les endpoints back-office.
 * Suppose une route authentifiée (le JwtAuthGuard aura attaché `request.user`).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
