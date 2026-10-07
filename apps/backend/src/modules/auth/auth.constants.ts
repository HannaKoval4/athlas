import { API_PREFIX } from '@atlas/shared';

/** Short-lived access JWT, sent to every API route. */
export const ACCESS_COOKIE = 'atlas_access';
export const ACCESS_COOKIE_PATH = `/${API_PREFIX}`;

/** Long-lived refresh JWT; the browser sends it only to /api/auth/* (refresh, logout). */
export const REFRESH_COOKIE = 'atlas_refresh';
export const REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`;

/** Window and default limit for throttling login/register/refresh per client IP and route. */
export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_DEFAULT_LIMIT = 10;

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
