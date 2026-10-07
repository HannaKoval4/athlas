import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import type { PrismaService } from '../../prisma/prisma.service';
import { TokenService, hashToken } from './token.service';

const ACCESS_SECRET = 'access-secret-for-tests';
const REFRESH_SECRET = 'refresh-secret-for-tests';

interface StoredToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const user = { id: 'user-1', role: Role.USER } as User;

/** In-memory stand-in for prisma.refreshToken with just the queries TokenService uses. */
function createPrismaFake() {
  const rows = new Map<string, StoredToken>();
  const matches = (row: StoredToken, where: Partial<StoredToken>) =>
    Object.entries(where).every(([key, value]) => row[key as keyof StoredToken] === value);

  const refreshToken = {
    create: jest.fn(({ data }: { data: Omit<StoredToken, 'revokedAt'> }) => {
      rows.set(data.id, { ...data, revokedAt: null });
      return Promise.resolve(rows.get(data.id));
    }),
    findUnique: jest.fn(({ where }: { where: { id: string } }) => {
      const row = rows.get(where.id);
      return Promise.resolve(row ? { ...row, user } : null);
    }),
    updateMany: jest.fn(
      ({ where, data }: { where: Partial<StoredToken>; data: { revokedAt: Date } }) => {
        let count = 0;
        for (const row of rows.values()) {
          if (matches(row, where)) {
            row.revokedAt = data.revokedAt;
            count += 1;
          }
        }
        return Promise.resolve({ count });
      },
    ),
  };
  return { rows, prisma: { refreshToken } as unknown as PrismaService, refreshToken };
}

function createService(prisma: PrismaService, ttl = { access: '15m', refresh: '7d' }) {
  const config = new ConfigService({
    JWT_ACCESS_SECRET: ACCESS_SECRET,
    JWT_REFRESH_SECRET: REFRESH_SECRET,
    JWT_ACCESS_TTL: ttl.access,
    JWT_REFRESH_TTL: ttl.refresh,
  });
  return new TokenService(prisma, new JwtService(), config);
}

describe('TokenService', () => {
  let fake: ReturnType<typeof createPrismaFake>;
  let service: TokenService;
  const jwt = new JwtService();

  beforeEach(() => {
    fake = createPrismaFake();
    service = createService(fake.prisma);
  });

  describe('issue', () => {
    it('stores only the SHA-256 hash of the refresh token, keyed by its jti', async () => {
      const { refreshToken } = await service.issue(user);
      const { jti } = jwt.decode<{ jti: string }>(refreshToken);

      const row = fake.rows.get(jti);
      expect(row?.tokenHash).toBe(hashToken(refreshToken));
      expect(row?.tokenHash).not.toBe(refreshToken);
      expect(row?.userId).toBe(user.id);
    });

    it('sets token lifetimes from JWT_ACCESS_TTL / JWT_REFRESH_TTL (BR-03)', async () => {
      const { accessToken, refreshToken } = await service.issue(user);
      const access = jwt.decode<{ iat: number; exp: number }>(accessToken);
      const refresh = jwt.decode<{ iat: number; exp: number }>(refreshToken);

      expect(access.exp - access.iat).toBe(15 * 60);
      expect(refresh.exp - refresh.iat).toBe(7 * 24 * 60 * 60);
    });

    it('puts the user id and role into the access token', async () => {
      const { accessToken } = await service.issue({ id: 'admin-1', role: Role.ADMIN });

      await expect(service.verifyAccess(accessToken)).resolves.toEqual({
        id: 'admin-1',
        role: Role.ADMIN,
      });
    });
  });

  describe('verifyAccess', () => {
    it('rejects a refresh token used as an access token (different secret)', async () => {
      const { refreshToken } = await service.issue(user);

      await expect(service.verifyAccess(refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired access token', async () => {
      const expired = jwt.sign(
        { sub: user.id, role: user.role, exp: Math.floor(Date.now() / 1000) - 10 },
        { secret: ACCESS_SECRET },
      );

      await expect(service.verifyAccess(expired)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token with a tampered payload', async () => {
      const { accessToken } = await service.issue(user);
      const [header, , signature] = accessToken.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({ sub: user.id, role: Role.ADMIN }),
      ).toString('base64url');

      await expect(
        service.verifyAccess(`${header}.${forgedPayload}.${signature}`),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unsigned token (alg "none")', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: user.id, role: Role.ADMIN })).toString(
        'base64url',
      );

      await expect(service.verifyAccess(`${header}.${payload}.`)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('rotate (BR-03)', () => {
    it('revokes the presented token and issues a new pair', async () => {
      const first = await service.issue(user);

      const { tokens } = await service.rotate(first.refreshToken);

      expect(tokens.refreshToken).not.toBe(first.refreshToken);
      const oldJti = jwt.decode<{ jti: string }>(first.refreshToken).jti;
      const newJti = jwt.decode<{ jti: string }>(tokens.refreshToken).jti;
      expect(fake.rows.get(oldJti)?.revokedAt).toBeInstanceOf(Date);
      expect(fake.rows.get(newJti)?.revokedAt).toBeNull();
    });

    it('on reuse of a revoked token revokes every session of the user', async () => {
      const first = await service.issue(user);
      const second = await service.rotate(first.refreshToken);

      await expect(service.rotate(first.refreshToken)).rejects.toThrow('reuse detected');

      const newJti = jwt.decode<{ jti: string }>(second.tokens.refreshToken).jti;
      expect(fake.rows.get(newJti)?.revokedAt).toBeInstanceOf(Date);
      await expect(service.rotate(second.tokens.refreshToken)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('treats a lost race (row already claimed) as reuse', async () => {
      const first = await service.issue(user);
      fake.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.rotate(first.refreshToken)).rejects.toThrow('reuse detected');
      expect(fake.refreshToken.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { userId: user.id, revokedAt: null } }),
      );
    });

    it('rejects a validly signed token whose row does not exist', async () => {
      const orphan = jwt.sign({ sub: user.id, jti: 'missing' }, { secret: REFRESH_SECRET });

      await expect(service.rotate(orphan)).rejects.toThrow('Invalid refresh token');
    });

    it('rejects a token whose hash does not match the stored one', async () => {
      const first = await service.issue(user);
      const { jti } = jwt.decode<{ jti: string }>(first.refreshToken);
      // Same jti, different token string (e.g. re-signed with a leaked secret but a new iat).
      const other = jwt.sign({ sub: user.id, jti, extra: 1 }, { secret: REFRESH_SECRET });

      await expect(service.rotate(other)).rejects.toThrow('Invalid refresh token');
    });

    it('rejects an access token presented as a refresh token', async () => {
      const { accessToken } = await service.issue(user);

      await expect(service.rotate(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('revoke / revokeAll', () => {
    it('revoke marks only the given token as revoked', async () => {
      const a = await service.issue(user);
      const b = await service.issue(user);

      await service.revoke(a.refreshToken);

      expect(
        fake.rows.get(jwt.decode<{ jti: string }>(a.refreshToken).jti)?.revokedAt,
      ).toBeInstanceOf(Date);
      expect(fake.rows.get(jwt.decode<{ jti: string }>(b.refreshToken).jti)?.revokedAt).toBeNull();
    });

    it('revoke ignores a garbage token instead of throwing', async () => {
      await expect(service.revoke('not-a-jwt')).resolves.toBeUndefined();
      expect(fake.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('revokeAll revokes every active token of the user', async () => {
      await service.issue(user);
      await service.issue(user);

      await service.revokeAll(user.id);

      expect([...fake.rows.values()].every((row) => row.revokedAt !== null)).toBe(true);
    });
  });

  it('fails fast on an invalid TTL in the configuration', () => {
    expect(() => createService(fake.prisma, { access: '15 minutes', refresh: '7d' })).toThrow(
      'Invalid duration',
    );
  });
});
