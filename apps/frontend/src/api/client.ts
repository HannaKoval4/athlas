import { API_PREFIX } from '@atlas/shared';

const API_URL = import.meta.env.VITE_API_URL ?? `http://localhost:3000/${API_PREFIX}`;

/** An HTTP error from the API; `status` drives UI messages (texts come from i18n, not from the server). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

/** Auth endpoints whose 401 means "wrong credentials / no session", never "access token expired". */
const NO_REFRESH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);

let sessionExpiredHandler: () => void = () => {};

/** Called once the session cannot be renewed (refresh failed); the app then shows the login page. */
export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Renews the access token with the refresh cookie. Concurrent 401s share ONE refresh request:
 * sending the same refresh token twice would look like token theft to the server (BR-03)
 * and end every session of the user.
 */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= send('/auth/refresh', { method: 'POST' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

function send(path: string, { method = 'GET', body }: RequestOptions): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    // Tokens are httpOnly cookies, so every request must carry credentials.
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText;
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (data.message)
      message = Array.isArray(data.message) ? data.message.join('; ') : data.message;
  } catch {
    // Not a JSON body: keep the status text.
  }
  return new ApiError(response.status, message);
}

/** JSON request to the API with transparent access-token renewal on 401. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && !NO_REFRESH_PATHS.has(path)) {
    if (await refreshSession()) {
      response = await send(path, options);
    } else {
      sessionExpiredHandler();
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
