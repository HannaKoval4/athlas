import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

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

export const API = 'http://localhost:3000/api';
export const PASSWORD = 'Secret123';

/** Throwaway users in the dev database are named e2e-*@example.test. */
export function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}
