import { API, PASSWORD, expect, test, uniqueEmail } from './fixtures.ts';

// Runs against the seeded dev database: Ancient Egypt (Nile valley and delta, -3100 .. -30)
// and Ancient Greece (Crete, Peloponnese, Central Greece, -3000 .. -146); eras early-antiquity,
// antiquity (-1200 .. 476) and early-middle-ages (no cultures seeded yet).
const BCE = /г\. до\s*н\.\s*э\./;

test.beforeEach(async ({ page }) => {
  // page.request shares the browser context's cookies, so the page is logged in afterwards.
  const res = await page.request.post(`${API}/auth/register`, {
    data: { email: uniqueEmail(), password: PASSWORD, name: 'Map' },
  });
  expect(res.status()).toBe(201);
});

test.describe('Map time slice', () => {
  test('highlights the regions of the year and shows the cultures of a clicked region', async ({
    page,
  }) => {
    await page.goto('/?era=antiquity&year=-450');

    await expect(page.getByTestId('selection-summary')).toHaveText(/Античность · 450/);
    await expect(page.getByTestId('regions-count')).toHaveText(/5$/);
    await expect(page.locator('path.atlas-region')).toHaveCount(5);
    await expect(page.getByText('Границы регионов условные.')).toBeVisible();

    await page.locator('path.region-crete').click();

    const details = page.getByTestId('region-details');
    await expect(details).toContainText('Крит');
    await expect(details.getByTestId('culture-ancient-greece')).toContainText(
      'датировка приблизительная',
    );
    await expect(page.getByTestId('region-crete')).toHaveAttribute('aria-pressed', 'true');
  });

  test('typing a year updates the map and the URL; Back restores the previous year', async ({
    page,
  }) => {
    await page.goto('/?era=antiquity&year=-450');
    await expect(page.getByTestId('regions-count')).toHaveText(/5$/);

    await page.getByTestId('year-input').fill('-100');
    await page.getByTestId('year-submit').click();

    // Greece ends in -146, Egypt in -30: only the two Egyptian regions remain.
    await expect(page).toHaveURL(/era=antiquity&year=-100$/);
    await expect(page.getByTestId('regions-count')).toHaveText(/2$/);
    await expect(page.locator('path.region-crete')).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/year=-450$/);
    await expect(page.getByTestId('regions-count')).toHaveText(/5$/);
    await expect(page.getByTestId('year-display')).toHaveText(BCE);
  });

  test('an era without materials shows the empty state', async ({ page }) => {
    await page.goto('/?era=antiquity&year=-450');

    await page.getByTestId('era-early-middle-ages').click();

    await expect(page).toHaveURL(/era=early-middle-ages&year=\d+$/);
    await expect(page.getByTestId('era-early-middle-ages')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('map-empty')).toBeVisible();
    await expect(page.locator('path.atlas-region')).toHaveCount(0);
  });

  test('the year input rejects year 0 and years outside the era (BR-05)', async ({ page }) => {
    await page.goto('/?era=antiquity&year=-450');
    const input = page.getByTestId('year-input');

    await input.fill('0');
    await page.getByTestId('year-submit').click();
    await expect(page.getByRole('alert')).toHaveText('Введите целый год, кроме 0.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill('600');
    await page.getByTestId('year-submit').click();
    await expect(page.getByRole('alert')).toContainText('Год должен быть в пределах эпохи');

    await expect(page).toHaveURL(/year=-450$/);
  });

  test('the slider steps from 1 BCE straight to 1 CE (there is no year 0)', async ({ page }) => {
    await page.goto('/?era=antiquity&year=-1');
    await expect(page.getByTestId('year-display')).toHaveText(/^1\s*г\. до/);

    await page.getByTestId('year-slider').focus();
    await page.keyboard.press('ArrowRight');

    await expect(page.getByTestId('year-display')).toHaveText(/^1\s*г\. н\.\s*э\./);
    await expect(page).toHaveURL(/year=1$/);
  });

  test('a broken URL is normalised to a valid era and year', async ({ page }) => {
    await page.goto('/?era=no-such-era&year=-450');
    // The year decides the era when the era slug is unknown.
    await expect(page).toHaveURL(/era=antiquity&year=-450$/);

    await page.goto('/?era=antiquity&year=-3000');
    // A year outside the era is clamped to the era's start.
    await expect(page).toHaveURL(/era=antiquity&year=-1200$/);

    await page.goto('/?year=abc');
    await expect(page).toHaveURL(/era=early-antiquity&year=-\d+$/);
  });

  test('regions can be chosen from the keyboard via the list', async ({ page }) => {
    await page.goto('/?era=early-antiquity&year=-2000');

    await page.getByTestId('region-nile-delta').focus();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('region-details')).toContainText('Дельта Нила');
    await expect(page.getByTestId('culture-ancient-egypt')).toBeVisible();
  });
});
