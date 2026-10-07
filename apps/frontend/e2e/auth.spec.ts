import type { Page } from '@playwright/test';
import { API, PASSWORD, expect, test, uniqueEmail } from './fixtures.ts';

// Each test registers its own throwaway user, so tests do not depend on the seed or each other.
// They run against the dev database: users are named e2e-*@example.test.

async function registerViaUi(page: Page, name: string, email: string, password = PASSWORD) {
  await page.goto('/register');
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('register-submit').click();
}

async function loginViaUi(page: Page, email: string, password: string) {
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByTestId('login-submit').click();
}

test.describe('Authentication', () => {
  test('protected pages redirect a guest to /login and back after login', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail();
    await request.post(`${API}/auth/register`, {
      data: { email, password: PASSWORD, name: 'Redirect' },
    });

    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);

    await loginViaUi(page, email, PASSWORD);

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId('profile-name')).toHaveValue('Redirect');
  });

  test('register → map → session survives reload → logout', async ({ page }) => {
    await registerViaUi(page, 'Ольга', uniqueEmail());

    // The map page normalises the URL to the default era and year.
    await expect(page).toHaveURL(/\/\?era=[a-z-]+&year=-?\d+$/);
    await expect(page.getByTestId('atlas-map')).toBeVisible();
    await expect(page.getByTestId('current-user-name')).toHaveText('Ольга');

    await page.reload();
    await expect(page.getByTestId('current-user-name')).toHaveText('Ольга');

    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('registration validates the password on the client (BR-02)', async ({ page }) => {
    await registerViaUi(page, 'Weak', uniqueEmail(), 'password');

    await expect(page.getByText('хотя бы одну букву и одну цифру')).toBeVisible();
    await expect(page.getByTestId('password-input')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/register$/);
  });

  test('registration with a taken e-mail shows a conflict message (BR-01)', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail();
    await request.post(`${API}/auth/register`, {
      data: { email, password: PASSWORD, name: 'First' },
    });

    await registerViaUi(page, 'Second', email.toUpperCase());

    await expect(page.getByTestId('auth-error')).toHaveText(/уже зарегистрирована/);
  });

  test('login with a wrong password shows an error and stays on /login', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail();
    await request.post(`${API}/auth/register`, {
      data: { email, password: PASSWORD, name: 'Wrong' },
    });
    await page.goto('/login');

    await loginViaUi(page, email, 'Wrong1234');

    await expect(page.getByTestId('auth-error')).toHaveText(/Неверная почта или пароль/);
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Profile', () => {
  test('changing the name and theme is saved and survives a reload', async ({ page }) => {
    await registerViaUi(page, 'Before', uniqueEmail());
    await page.getByRole('link', { name: 'Профиль' }).click();

    await page.getByTestId('profile-name').fill('After');
    await page.getByTestId('profile-theme').selectOption('DARK');
    await page.getByTestId('profile-save').click();

    await expect(page.getByTestId('profile-saved')).toBeVisible();
    await expect(page.getByTestId('current-user-name')).toHaveText('After');
    await page.reload();
    await expect(page.getByTestId('profile-name')).toHaveValue('After');
    await expect(page.getByTestId('profile-theme')).toHaveValue('DARK');
  });

  test('changing the password: the new one works, the old one does not', async ({ page }) => {
    const email = uniqueEmail();
    await registerViaUi(page, 'Pass', email);
    // Wait for the session cookies before navigating away from the form.
    await expect(page.getByTestId('atlas-map')).toBeVisible();
    await page.goto('/profile');

    await page.getByTestId('current-password').fill('Wrong1234');
    await page.getByTestId('new-password').fill('NewSecret456');
    await page.getByTestId('password-submit').click();
    await expect(page.getByText('Текущий пароль указан неверно')).toBeVisible();

    await page.getByTestId('current-password').fill(PASSWORD);
    await page.getByTestId('password-submit').click();
    await expect(page.getByTestId('password-changed')).toBeVisible();

    await page.getByTestId('logout-button').click();
    await loginViaUi(page, email, PASSWORD);
    await expect(page.getByTestId('auth-error')).toBeVisible();
    await loginViaUi(page, email, 'NewSecret456');
    // Logged out from /profile, so login returns there.
    await expect(page).toHaveURL(/\/profile$/);
  });
});
