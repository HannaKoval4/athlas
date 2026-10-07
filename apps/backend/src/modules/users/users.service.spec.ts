import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { Role, ThemePreference } from '../../generated/prisma/enums';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PasswordService } from '../auth/password.service';
import type { TokenService } from '../auth/token.service';
import { UsersService } from './users.service';

const user = {
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'old-hash',
  role: Role.USER,
} as User;
const tokens = { accessToken: 'access', refreshToken: 'refresh' };

describe('UsersService', () => {
  const prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
  const passwords = { verify: jest.fn(), hash: jest.fn().mockResolvedValue('new-hash') };
  const tokenService = {
    revokeAll: jest.fn().mockResolvedValue(undefined),
    issue: jest.fn().mockResolvedValue(tokens),
  };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
    service = new UsersService(
      prisma as unknown as PrismaService,
      passwords as unknown as PasswordService,
      tokenService as unknown as TokenService,
    );
  });

  describe('updateProfile', () => {
    it('passes only the given fields (undefined fields are left unchanged by Prisma)', async () => {
      prisma.user.update.mockResolvedValue({ ...user, theme: ThemePreference.DARK });

      await service.updateProfile(user.id, { theme: ThemePreference.DARK });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { name: undefined, email: undefined, theme: ThemePreference.DARK, locale: undefined },
      });
    });

    it('maps a taken e-mail (P2002) to 409 Conflict (BR-01)', async () => {
      prisma.user.update.mockRejectedValueOnce(
        Object.assign(new Error('Unique'), { code: 'P2002' }),
      );

      await expect(
        service.updateProfile(user.id, { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('returns 401 if the user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateProfile('gone', { name: 'X' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('changePassword', () => {
    const dto = { currentPassword: 'Old12345', newPassword: 'New12345' };

    it('rejects a wrong current password with 400 and keeps sessions', async () => {
      passwords.verify.mockResolvedValue(false);

      await expect(service.changePassword(user.id, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(tokenService.revokeAll).not.toHaveBeenCalled();
    });

    it('stores the new hash, revokes all sessions, then opens a new one', async () => {
      passwords.verify.mockResolvedValue(true);

      await expect(service.changePassword(user.id, dto)).resolves.toBe(tokens);

      expect(passwords.verify).toHaveBeenCalledWith('old-hash', 'Old12345');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { passwordHash: 'new-hash' },
      });
      const revokeOrder = tokenService.revokeAll.mock.invocationCallOrder[0];
      const issueOrder = tokenService.issue.mock.invocationCallOrder[0];
      expect(revokeOrder).toBeLessThan(issueOrder);
    });
  });
});
