import {
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import type { Role } from '../../generated/prisma/enums';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants';
import type { AuthUser, AuthenticatedRequest } from './auth.types';

/** Opts a route (or controller) out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route (or controller) to the given roles; checked by RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated user ({ id, role }) set by JwtAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) {
    // Only reachable if the decorator is used on a @Public() route by mistake.
    throw new UnauthorizedException('Not authenticated');
  }
  return request.user satisfies AuthUser;
});
