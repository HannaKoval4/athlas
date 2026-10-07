import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isUniqueViolation } from '../../prisma/prisma-errors';
import type { IssuedTokens } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export interface AuthResult {
  user: User;
  tokens: IssuedTokens;
}

/** Same message for unknown e-mail and wrong password: the API does not reveal which accounts exist. */
export const INVALID_CREDENTIALS = 'Invalid e-mail or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  /** DTO validation has already normalized the e-mail (BR-01) and checked the password (BR-02). */
  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(dto.password);
    let user: User;
    try {
      user = await this.prisma.user.create({
        // The DTO accepts only consent === true, so reaching this line means consent was given.
        data: { email: dto.email, name: dto.name, passwordHash, consentAt: new Date() },
      });
    } catch (error) {
      // The UNIQUE index is the source of truth, so even two simultaneous sign-ups cannot both win.
      if (isUniqueViolation(error)) {
        throw new ConflictException('This e-mail is already registered');
      }
      throw error;
    }
    return { user, tokens: await this.tokens.issue(user) };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const valid = user
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : await this.passwords.verifyAgainstDummy(dto.password);
    if (!user || !valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return { user, tokens: await this.tokens.issue(user) };
  }

  refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.tokens.revoke(refreshToken);
    }
  }

  /** The access token may outlive the account (it is stateless), so a missing user is a 401. */
  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user;
  }
}
