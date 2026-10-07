import { Body, Controller, HttpCode, HttpStatus, Patch, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthCookiesService } from '../auth/auth-cookies.service';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileDto, toUserProfile } from './user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth(ACCESS_COOKIE)
@ApiUnauthorizedResponse({ description: 'Not authenticated' })
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly cookies: AuthCookiesService,
  ) {}

  @Patch()
  @ApiOkResponse({ type: UserProfileDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'E-mail already registered' })
  async updateProfile(
    @CurrentUser() current: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    return toUserProfile(await this.users.updateProfile(current.id, dto));
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Password changed; other sessions revoked, new cookies set',
  })
  @ApiBadRequestResponse({ description: 'Current password is incorrect or new password is weak' })
  async changePassword(
    @CurrentUser() current: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const tokens = await this.users.changePassword(current.id, dto);
    this.cookies.set(res, tokens);
  }
}
