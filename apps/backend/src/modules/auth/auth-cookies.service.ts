import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
} from './auth.constants';
import type { IssuedTokens } from './auth.types';
import { TokenService } from './token.service';

/**
 * Tokens travel only in httpOnly cookies: page scripts (and therefore XSS) cannot read them.
 * SameSite=Lax stops the browser from attaching them to cross-site POST/PATCH requests (CSRF).
 */
@Injectable()
export class AuthCookiesService {
  private readonly secure: boolean;

  constructor(
    private readonly tokens: TokenService,
    config: ConfigService,
  ) {
    this.secure = config.get<string>('NODE_ENV') === 'production';
  }

  set(res: Response, issued: IssuedTokens): void {
    res.cookie(ACCESS_COOKIE, issued.accessToken, {
      ...this.base(ACCESS_COOKIE_PATH),
      maxAge: this.tokens.accessTtlMs,
    });
    res.cookie(REFRESH_COOKIE, issued.refreshToken, {
      ...this.base(REFRESH_COOKIE_PATH),
      maxAge: this.tokens.refreshTtlMs,
    });
  }

  clear(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, this.base(ACCESS_COOKIE_PATH));
    res.clearCookie(REFRESH_COOKIE, this.base(REFRESH_COOKIE_PATH));
  }

  readAccess(req: Request): string | undefined {
    return readCookie(req, ACCESS_COOKIE);
  }

  readRefresh(req: Request): string | undefined {
    return readCookie(req, REFRESH_COOKIE);
  }

  private base(path: string): CookieOptions {
    return { httpOnly: true, sameSite: 'lax', secure: this.secure, path };
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
