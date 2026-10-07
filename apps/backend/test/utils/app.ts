import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export const FRONTEND_ORIGIN = 'http://localhost:5173';

/** The full application with the same global setup as main.ts (prefix, pipes, cookies, guards). */
export async function createTestApp(
  extra: { controllers?: Type[] } = {},
): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extra.controllers ?? [],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  configureApp(app, { frontendOrigin: FRONTEND_ORIGIN });
  await app.init();
  return app;
}

/** Raw Set-Cookie header for one cookie name, e.g. "atlas_access=...; Path=/api; HttpOnly". */
export function setCookie(res: Response, name: string): string | undefined {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  const all = Array.isArray(header) ? header : header ? [header] : [];
  return all.find((cookie) => cookie.startsWith(`${name}=`));
}

/** Value of a cookie set by the response (empty string for a cleared cookie). */
export function cookieValue(res: Response, name: string): string | undefined {
  return setCookie(res, name)
    ?.split(';')[0]
    .slice(name.length + 1);
}

/** Standard Nest error body. */
export interface ErrorBody {
  statusCode: number;
  message: string | string[];
}

/** Typed access to a JSON response body (supertest types it as `any`). */
export function json<T>(res: Response): T {
  return res.body as T;
}
