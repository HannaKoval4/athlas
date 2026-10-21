import { Controller, applyDecorators } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../generated/prisma/enums';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { Roles } from '../auth/decorators';

/** A controller under /api/admin/<path>, open to the ADMIN role only (403 for users). */
export function AdminController(path: string): ClassDecorator {
  return applyDecorators(
    Controller(`admin/${path}`),
    Roles(Role.ADMIN),
    ApiTags('admin'),
    ApiCookieAuth(ACCESS_COOKIE),
    ApiUnauthorizedResponse({ description: 'Not authenticated' }),
    ApiForbiddenResponse({ description: 'Not an admin' }),
  );
}
