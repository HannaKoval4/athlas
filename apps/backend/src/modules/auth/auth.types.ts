import type { Request } from 'express';
import type { Role } from '../../generated/prisma/enums';

/** Identity extracted from a valid access token and attached to the request. */
export interface AuthUser {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  /** Id of the RefreshToken row: lets the server find, rotate and revoke this exact token. */
  jti: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}
