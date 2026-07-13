import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Réponse d'authentification. Le refresh token n'est PAS dans le corps JSON :
 * il est posé en cookie HttpOnly par le controller (voir AuthController).
 */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: {
    id: number;
    email: string;
    fullName: string;
    phone: string | null;
    role: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Message volontairement identique dans les deux cas :
    // ne jamais révéler si c'est l'email ou le mot de passe qui est faux
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    return this.buildAuthResult(user);
  }

  /**
   * Échange un refresh token valide contre un nouvel access token + un refresh
   * token roté (rotation à chaque usage, SPEC §5.1).
   */
  async refresh(presentedToken: string): Promise<AuthResult> {
    const rotated = await this.refreshTokenService.rotate(presentedToken);
    const user = await this.usersService.findOne(rotated.userId);

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: rotated.token,
      refreshExpiresAt: rotated.expiresAt,
      user: this.publicUser(user),
    };
  }

  /** Logout d'une session : révoque le refresh token courant. */
  async logout(presentedToken: string | undefined): Promise<void> {
    if (presentedToken) {
      await this.refreshTokenService.revoke(presentedToken);
    }
  }

  /** Logout de toutes les sessions de l'utilisateur. */
  async logoutAll(userId: number): Promise<void> {
    await this.refreshTokenService.revokeAllForUser(userId);
  }

  private async buildAuthResult(user: User): Promise<AuthResult> {
    const issued = await this.refreshTokenService.issue(user);
    return {
      accessToken: this.signAccessToken(user),
      refreshToken: issued.token,
      refreshExpiresAt: issued.expiresAt,
      user: this.publicUser(user),
    };
  }

  private signAccessToken(user: User): string {
    const payload = {
      sub: user.id, // "sub" (subject) : convention JWT pour l'identifiant
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  private publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
    };
  }
}
