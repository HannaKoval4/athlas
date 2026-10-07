import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/enums';
import type { AuthCookiesService } from '../auth-cookies.service';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../auth.constants';
import type { AuthUser } from '../auth.types';
import type { TokenService } from '../token.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

function createContext(request: { user?: AuthUser }): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function reflectorWith(metadata: Record<string, unknown>): Reflector {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockImplementation((key: unknown) => metadata[key as string]);
  return reflector;
}

describe('JwtAuthGuard', () => {
  const tokens = { verifyAccess: jest.fn() };
  const cookies = { readAccess: jest.fn() };
  const guard = (metadata: Record<string, unknown> = {}) =>
    new JwtAuthGuard(
      reflectorWith(metadata),
      tokens as unknown as TokenService,
      cookies as unknown as AuthCookiesService,
    );

  beforeEach(() => jest.clearAllMocks());

  it('lets @Public() routes through without a token', async () => {
    await expect(guard({ [IS_PUBLIC_KEY]: true }).canActivate(createContext({}))).resolves.toBe(
      true,
    );
    expect(cookies.readAccess).not.toHaveBeenCalled();
  });

  it('returns 401 when the access cookie is missing', async () => {
    cookies.readAccess.mockReturnValue(undefined);

    await expect(guard().canActivate(createContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the verified user to the request', async () => {
    const request: { user?: AuthUser } = {};
    cookies.readAccess.mockReturnValue('token');
    tokens.verifyAccess.mockResolvedValue({ id: 'u1', role: Role.USER });

    await expect(guard().canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'u1', role: Role.USER });
  });

  it('propagates 401 for an invalid token', async () => {
    cookies.readAccess.mockReturnValue('bad');
    tokens.verifyAccess.mockRejectedValue(new UnauthorizedException());

    await expect(guard().canActivate(createContext({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('RolesGuard', () => {
  const user: AuthUser = { id: 'u1', role: Role.USER };
  const admin: AuthUser = { id: 'a1', role: Role.ADMIN };

  it('allows any authenticated user when no roles are required', () => {
    expect(new RolesGuard(reflectorWith({})).canActivate(createContext({ user }))).toBe(true);
  });

  it('allows a user with a required role', () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: [Role.ADMIN] }));

    expect(guard.canActivate(createContext({ user: admin }))).toBe(true);
  });

  it('returns 403 for an authenticated user without the role', () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: [Role.ADMIN] }));

    expect(() => guard.canActivate(createContext({ user }))).toThrow(ForbiddenException);
  });

  it('returns 401 if a role is required but nobody is authenticated', () => {
    const guard = new RolesGuard(reflectorWith({ [ROLES_KEY]: [Role.ADMIN] }));

    expect(() => guard.canActivate(createContext({}))).toThrow(UnauthorizedException);
  });
});
