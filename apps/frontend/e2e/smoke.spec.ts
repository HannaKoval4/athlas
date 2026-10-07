import { expect, test } from './fixtures.ts';

test.describe('Smoke', () => {
  test('the API is up and reaches the database', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/health');

    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ status: 'ok', database: 'up' });
  });

  test('a guest opening the app sees the login page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
