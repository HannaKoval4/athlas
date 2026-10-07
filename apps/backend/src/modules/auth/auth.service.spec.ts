import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuthService, INVALID_CREDENTIALS } from './auth.service';
import type { TokenService } from './token.service';

const tokens = { accessToken: 'access', refreshToken: 'refresh' };
const existingUser = {
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'hash',
  role: Role.USER,
} as User;

describe('AuthService', () => {
  const prisma = { user: { create: jest.fn(), findUnique: jest.fn() } };
  const passwords = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    verify: jest.fn(),
    verifyAgainstDummy: jest.fn().mockResolvedValue(false),
  };
  const tokenService = {
    issue: jest.fn().mockResolvedValue(tokens),
    rotate: jest.fn(),
    revoke: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as unknown as PrismaService,
      passwords,
      tokenService as unknown as TokenService,
    );
  });

  describe('register', () => {
    const dto = { email: 'new@example.com', password: 'Secret123', name: 'New', consent: true };

    it('stores the argon2 hash, never the plain password, and opens a session', async () => {
      prisma.user.create.mockResolvedValue({ ...existingUser, email: dto.email });

      const result = await service.register(dto);

      expect(passwords.hash).toHaveBeenCalledWith('Secret123');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash: 'new-hash',
          consentAt: expect.any(Date) as unknown,
        },
      });
      expect(result.tokens).toBe(tokens);
    });

    it('maps a unique violation (P2002) to 409 Conflict (BR-01)', async () => {
      prisma.user.create.mockRejectedValueOnce(
        Object.assign(new Error('Unique'), { code: 'P2002' }),
      );

      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(tokenService.issue).not.toHaveBeenCalled();
    });

    it('rethrows other database errors unchanged', async () => {
      const failure = new Error('connection lost');
      prisma.user.create.mockRejectedValueOnce(failure);

      await expect(service.register(dto)).rejects.toBe(failure);
    });
  });

  describe('login', () => {
    const dto = { email: 'user@example.com', password: 'Secret123' };

    it('opens a session for correct credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);
      passwords.verify.mockResolvedValue(true);

      await expect(service.login(dto)).resolves.toEqual({ user: existingUser, tokens });
    });

    it('returns 401 with a generic message for a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(existingUser);
      passwords.verify.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
      expect(tokenService.issue).not.toHaveBeenCalled();
    });

    it('returns the same 401 for an unknown e-mail and still spends time hashing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
      expect(passwords.verifyAgainstDummy).toHaveBeenCalledWith('Secret123');
    });
  });

  describe('refresh / logout', () => {
    it('refresh without a cookie is 401', () => {
      expect(() => service.refresh(undefined)).toThrow(UnauthorizedException);
      expect(tokenService.rotate).not.toHaveBeenCalled();
    });

    it('logout without a cookie does nothing', async () => {
      await service.logout(undefined);

      expect(tokenService.revoke).not.toHaveBeenCalled();
    });

    it('logout revokes the presented refresh token', async () => {
      await service.logout('refresh');

      expect(tokenService.revoke).toHaveBeenCalledWith('refresh');
    });
  });

  it('getCurrentUser returns 401 if the account was deleted after the token was issued', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getCurrentUser('gone')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
