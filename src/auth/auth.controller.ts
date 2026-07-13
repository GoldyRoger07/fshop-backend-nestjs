import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, CookieOptions } from 'express';
import { AuthService, AuthResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

/** Nom du cookie portant le refresh token. */
const REFRESH_COOKIE = 'refresh_token';
/** Le cookie n'est renvoyé que sur les routes d'auth (limite l'exposition). */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respondWithTokens(await this.authService.register(dto), res);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK) // sinon Nest renvoie 201 par défaut sur un POST
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respondWithTokens(await this.authService.login(dto), res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      // Pas de cookie → rien à rafraîchir. On délègue le 401 au service.
      return this.respondWithTokens(await this.authService.refresh(''), res);
    }
    return this.respondWithTokens(await this.authService.refresh(token), res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  // Non marquée @Public() → le JwtAuthGuard global exige un access token valide.
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.id);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  /**
   * Pose le refresh token en cookie HttpOnly et ne renvoie dans le corps que
   * l'access token + l'utilisateur (le refresh ne transite jamais en JSON).
   */
  private respondWithTokens(result: AuthResult, res: Response) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, this.refreshCookieOptions(result.refreshExpiresAt));
    return { accessToken: result.accessToken, user: result.user };
  }

  private refreshCookieOptions(expiresAt: Date): CookieOptions {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProd, // HTTPS obligatoire en prod
      sameSite: 'lax', // compat navigation SSR (SPEC §5.1)
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
    };
  }
}
