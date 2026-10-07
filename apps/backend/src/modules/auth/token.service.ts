import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { parseDuration } from '../../common/duration';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessTokenPayload, AuthUser, IssuedTokens, RefreshTokenPayload } from './auth.types';

const JWT_ALGORITHM = 'HS256';

/** The refresh JWT already carries 256+ bits of signature entropy, so a fast hash is enough. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Issues, verifies, rotates and revokes JWTs (BR-03).
 * Access tokens are stateless; refresh tokens are also stored (as a hash) in RefreshToken,
 * which makes rotation, logout and reuse detection possible.
 */
@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  readonly accessTtlMs: number;
  readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessTtlMs = parseDuration(config.get<string>('JWT_ACCESS_TTL', '15m'));
    this.refreshTtlMs = parseDuration(config.get<string>('JWT_REFRESH_TTL', '7d'));
  }

  /** Creates a new session: an access token and a refresh token persisted as a hash. */
  async issue(user: Pick<User, 'id' | 'role'>): Promise<IssuedTokens> {
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti } satisfies RefreshTokenPayload,
      {
        secret: this.refreshSecret,
        algorithm: JWT_ALGORITHM,
        expiresIn: Math.floor(this.refreshTtlMs / 1000),
      },
    );
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role } satisfies AccessTokenPayload,
      {
        secret: this.accessSecret,
        algorithm: JWT_ALGORITHM,
        expiresIn: Math.floor(this.accessTtlMs / 1000),
      },
    );
    return { accessToken, refreshToken };
  }

  /** Validates signature and expiry of an access token. Throws 401 otherwise. */
  async verifyAccess(token: string): Promise<AuthUser> {
    const payload = await this.verify<AccessTokenPayload>(token, this.accessSecret);
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
      throw new UnauthorizedException('Invalid access token');
    }
    return { id: payload.sub, role: payload.role };
  }

  /**
   * BR-03 rotation: a refresh token can be exchanged exactly once.
   * Presenting an already revoked token means it was stolen (or replayed), so every
   * session of that user is revoked and the client has to log in again.
   */
  async rotate(refreshToken: string): Promise<{ user: User; tokens: IssuedTokens }> {
    const payload = await this.verify<RefreshTokenPayload>(refreshToken, this.refreshSecret);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });
    if (
      !stored ||
      stored.userId !== payload.sub ||
      !sameHash(stored.tokenHash, hashToken(refreshToken))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Conditional update = atomic "claim": of two concurrent requests with the same token
    // only one sees count = 1; the other is treated as reuse.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeAll(stored.userId);
      throw new UnauthorizedException('Refresh token reuse detected; all sessions were revoked');
    }

    return { user: stored.user, tokens: await this.issue(stored.user) };
  }

  /** Logout: revokes the given refresh token if it is valid. Never throws. */
  async revoke(refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.verify<RefreshTokenPayload>(refreshToken, this.refreshSecret);
    } catch {
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: {
        id: payload.jti,
        userId: payload.sub,
        tokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /** Ends every active session of the user (reuse detection, password change). */
  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async verify<T extends object>(token: string, secret: string): Promise<T> {
    try {
      return await this.jwt.verifyAsync<T>(token, { secret, algorithms: [JWT_ALGORITHM] });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
