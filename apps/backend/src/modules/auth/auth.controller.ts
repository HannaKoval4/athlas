import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UserProfileDto, toUserProfile } from '../users/user-profile.dto';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthService } from './auth.service';
import { ACCESS_COOKIE } from './auth.constants';
import type { AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
// Brute-force protection for the credential endpoints (limit per IP and route, see AuthModule).
@UseGuards(ThrottlerGuard)
@ApiTooManyRequestsResponse({ description: 'Too many attempts, try again later' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({ type: UserProfileDto, description: 'Account created, cookies set' })
  @ApiBadRequestResponse({ description: 'Validation failed (e-mail, password policy, name)' })
  @ApiConflictResponse({ description: 'E-mail already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserProfileDto> {
    const { user, tokens } = await this.auth.register(dto);
    this.cookies.set(res, tokens);
    return toUserProfile(user);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserProfileDto, description: 'Logged in, cookies set' })
  @ApiUnauthorizedResponse({ description: 'Invalid e-mail or password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserProfileDto> {
    const { user, tokens } = await this.auth.login(dto);
    this.cookies.set(res, tokens);
    return toUserProfile(user);
  }

  /** Public: it is called exactly when the access token has expired. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserProfileDto, description: 'Tokens rotated, new cookies set' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, expired or reused refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserProfileDto> {
    try {
      const { user, tokens } = await this.auth.refresh(this.cookies.readRefresh(req));
      this.cookies.set(res, tokens);
      return toUserProfile(user);
    } catch (error) {
      // A dead refresh token is useless to the client: drop both cookies.
      this.cookies.clear(res);
      throw error;
    }
  }

  @Public()
  @SkipThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Refresh token revoked, cookies cleared' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.cookies.readRefresh(req));
    this.cookies.clear(res);
  }

  @SkipThrottle()
  @Get('me')
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiOkResponse({ type: UserProfileDto })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async me(@CurrentUser() current: AuthUser): Promise<UserProfileDto> {
    return toUserProfile(await this.auth.getCurrentUser(current.id));
  }
}
