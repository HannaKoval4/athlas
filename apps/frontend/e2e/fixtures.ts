import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { type Page, test as base, expect } from '@playwright/test';

export { expect };

export const API = 'http://localhost:3000/api';
export const PASSWORD = 'Secret123';

/** Throwaway users in the dev database are named e2e-*@example.test. */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/**
 * Every UI test runs without the external tile server: tests must not depend on the network
 * or load OpenStreetMap's servers. Regions are drawn as SVG on top and do not need tiles.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
    await use(page);
  },
});

/**
 * Tests that only need *some* logged-in user: one account per Playwright worker, its cookies
 * reused by every test of that worker. This keeps the number of sign-ups low, so the suites
 * stay under the auth rate limit (BR: throttling) even against a running dev server.
 * Tests must not log out or change the password (that would revoke the shared session).
 */
export const userTest = test.extend<object, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [
    async ({ browser }, use, workerInfo) => {
      const dir = path.join(workerInfo.project.outputDir, '.auth');
      const file = path.join(dir, `worker-${workerInfo.parallelIndex}.json`);
      if (!existsSync(file)) {
        await mkdir(dir, { recursive: true });
        const context = await browser.newContext({ storageState: undefined });
        const res = await context.request.post(`${API}/auth/register`, {
          data: { email: uniqueEmail(), password: PASSWORD, name: 'Reader', consent: true },
        });
        if (res.status() !== 201) throw new Error(`Sign-up failed: ${res.status()}`);
        await context.storageState({ path: file });
        await context.close();
      }
      await use(file);
    },
    { scope: 'worker' },
  ],
});

/** Asserts ?era= and ?year= of the current URL regardless of parameter order. */
export async function expectSelection(page: Page, era: string, year: RegExp | string) {
  await expect
    .poll(() => {
      const params = new URL(page.url()).searchParams;
      return `${params.get('era')} ${params.get('year')}`;
    })
    .toMatch(new RegExp(`^${era} ${typeof year === 'string' ? year : year.source}$`));
}

/** The seeded admin (SEED_ADMIN_* from the repo's .env, or the .env.example defaults). */
function seedAdmin(): { email: string; password: string } {
  const env: Record<string, string> = {};
  const file = path.join(import.meta.dirname, '..', '..', '..', '.env');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match?.[1] && match[2] !== undefined) env[match[1]] = match[2];
    }
  }
  return {
    email: process.env.SEED_ADMIN_EMAIL ?? env.SEED_ADMIN_EMAIL ?? 'admin@atlas.local',
    password: process.env.SEED_ADMIN_PASSWORD ?? env.SEED_ADMIN_PASSWORD ?? 'Admin12345',
  };
}

/** Like userTest, but the worker's session belongs to the seeded admin. */
export const adminTest = test.extend<object, { adminStorageState: string }>({
  storageState: ({ adminStorageState }, use) => use(adminStorageState),
  adminStorageState: [
    async ({ browser }, use, workerInfo) => {
      const dir = path.join(workerInfo.project.outputDir, '.auth');
      const file = path.join(dir, `admin-${workerInfo.parallelIndex}.json`);
      if (!existsSync(file)) {
        await mkdir(dir, { recursive: true });
        const context = await browser.newContext({ storageState: undefined });
        const res = await context.request.post(`${API}/auth/login`, { data: seedAdmin() });
        if (res.status() !== 200) throw new Error(`Admin login failed: ${res.status()}`);
        await context.storageState({ path: file });
        await context.close();
      }
      await use(file);
    },
    { scope: 'worker' },
  ],
});
