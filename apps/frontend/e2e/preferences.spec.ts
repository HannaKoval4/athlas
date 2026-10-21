import type { Page } from '@playwright/test';
import { API, PASSWORD, expect, test, uniqueEmail } from './fixtures.ts';

// E2E-04: theme and language apply at once and are kept in the profile across sessions.
// Each test signs up its own user, so the choices do not leak into other tests.

const html = (page: Page) => page.locator('html');

test.describe('Theme and language (F-17)', () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.post(`${API}/auth/register`, {
      data: { email: uniqueEmail(), password: PASSWORD, name: 'Prefs', consent: true },
    });
    expect(res.status()).toBe(201);
  });

  test('the profile switches the theme and language without saving and keeps them after a re-login', async ({
    page,
  }) => {
    await page.goto('/profile');

    await page.getByTestId('profile-theme').selectOption('DARK');
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await page.getByTestId('profile-locale').selectOption('EN');
    await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
    await expect(html(page)).toHaveAttribute('lang', 'en');

    // Stored in the DB: a fresh browser without localStorage gets them from /auth/me.
    const me = await page.request.get(`${API}/auth/me`);
    expect(await me.json()).toMatchObject({ theme: 'DARK', locale: 'EN' });

    await page.reload();
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(page.getByRole('link', { name: 'Map', exact: true })).toBeVisible();
    await expect(page.getByTestId('profile-theme')).toHaveValue('DARK');
    await expect(page.getByTestId('profile-locale')).toHaveValue('EN');
  });

  test('the header switches change the language of the whole page, years included', async ({
    page,
  }) => {
    await page.goto('/?era=antiquity&year=-450');
    await expect(page.getByTestId('selection-summary')).toContainText(/450\sг\. до\sн\.\sэ\./);

    await page.getByTestId('locale-switch').click();

    // Scoped to the header: "Today in history" may have its own Calendar link.
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Calendar' })).toBeVisible();
    await expect(page.getByTestId('selection-summary')).toContainText('450 BCE');

    await page.getByTestId('theme-switch').click(); // SYSTEM -> LIGHT
    await expect(page.getByTestId('theme-switch')).toHaveAttribute('data-theme', 'LIGHT');
    await expect(html(page)).not.toHaveClass(/\bdark\b/);
    await page.getByTestId('theme-switch').click(); // LIGHT -> DARK
    await expect(html(page)).toHaveClass(/\bdark\b/);
  });

  test('"As in the system" follows the OS color scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/profile');
    await expect(page.getByTestId('profile-theme')).toHaveValue('SYSTEM');
    await expect(html(page)).toHaveClass(/\bdark\b/);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html(page)).not.toHaveClass(/\bdark\b/);
  });
});

test('a guest can switch the language on the login page', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('locale-switch').click();

  await expect(page.getByTestId('login-submit')).toHaveText('Log in');
  await expect(html(page)).toHaveAttribute('lang', 'en');
});
