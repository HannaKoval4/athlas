import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isUniqueViolation } from '../../prisma/prisma-errors';
import type { IssuedTokens } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { TokenService } from '../auth/token.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /** Updates name, e-mail (BR-01: unique, lower-case), theme and locale. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    await this.findOrFail(userId);
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { name: dto.name, email: dto.email, theme: dto.theme, locale: dto.locale },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('This e-mail is already registered');
      }
      throw error;
    }
  }

  /**
   * Requires the current password, then ends every session of the user (a stolen refresh token
   * stops working) and opens a fresh one for the caller, so they stay logged in on this device.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<IssuedTokens> {
    const user = await this.findOrFail(userId);
    if (!(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      // 400, not 401: the session is valid, only the form input is wrong.
      throw new BadRequestException('Current password is incorrect');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(dto.newPassword) },
    });
    await this.tokens.revokeAll(userId);
    return this.tokens.issue(user);
  }

  private async findOrFail(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user;
  }
}
