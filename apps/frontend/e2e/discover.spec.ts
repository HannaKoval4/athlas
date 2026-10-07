import { expect, userTest as test } from './fixtures.ts';

// Runs against the seeded dev database (Egypt and Greece, published one day apart).

test.describe('Random topic, "New" and view history', () => {
  test('"Random topic" opens a filled culture and explains the choice', async ({ page }) => {
    await page.goto('/notes');

    await page.getByTestId('random-topic').click();

    await expect(page).toHaveURL(/\/cultures\/[a-z-]+\?era=[a-z-]+&year=-?\d+/);
    const sheet = page.getByTestId('culture-sheet');
    await expect(sheet.getByTestId('random-topic-reason')).toContainText('Случайная тема:');
    await expect(sheet.getByTestId('random-topic-reason')).toContainText(/Здесь \d+ материал/);
  });

  test('"New" lists the latest published cards and opens them', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Новое', exact: true }).click();

    const items = page.getByTestId('new-page').getByRole('listitem');
    await expect(items).toHaveCount(10);
    await expect(items.first()).toContainText('Опубликовано');

    const title = await items.first().getByRole('link').first().innerText();
    await items.first().getByRole('link').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  });

  test('an opened card appears first in the profile history', async ({ page }) => {
    await page.goto('/cards/great-pyramid');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/cards/parthenon');
    await expect(page.getByRole('heading', { level: 1, name: 'Парфенон' })).toBeVisible();

    await page.goto('/profile');

    const history = page.getByTestId('view-history').getByRole('listitem');
    await expect(history.first()).toContainText('Парфенон');
    await expect(history.nth(1)).toContainText('Великая пирамида');
  });
});
