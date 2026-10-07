import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthCookiesService } from '../auth-cookies.service';
import { IS_PUBLIC_KEY } from '../auth.constants';
import type { AuthenticatedRequest } from '../auth.types';
import { TokenService } from '../token.service';

/**
 * Global guard: every route requires a valid access token unless marked @Public().
 * "Secure by default" — a new endpoint cannot be left unprotected by forgetting a decorator.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly cookies: AuthCookiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.cookies.readAccess(request);
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }
    request.user = await this.tokens.verifyAccess(token);
    return true;
  }
}
