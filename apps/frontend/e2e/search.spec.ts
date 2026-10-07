import { expect, userTest as test } from './fixtures.ts';

// Runs against the seeded dev database (Egypt and Greece, 15 cards each).

test.describe('Search', () => {
  test('typing finds a card by the beginning of a word; "On the map" opens its culture', async ({
    page,
  }) => {
    await page.goto('/search');
    await expect(page.getByTestId('search-prompt')).toBeVisible();

    await page.getByTestId('search-input').fill('парфен');

    const card = page.getByTestId('result-card-parthenon');
    await expect(card).toBeVisible();
    await expect(card.locator('mark').first()).toHaveText(/^Парфен/i);
    await expect(page).toHaveURL(/[?&]q=%D0%BF%D0%B0%D1%80%D1%84%D0%B5%D0%BD/);

    await card.getByRole('link', { name: 'На карте' }).click();
    await expect(page).toHaveURL(/\/cultures\/ancient-greece\?/);
    await expect(page.getByTestId('culture-sheet')).toBeVisible();
  });

  test('cards, cultures and holidays are grouped; a card type narrows to cards', async ({
    page,
  }) => {
    await page.goto('/search?q=панафинеи');

    await expect(page.getByTestId('result-card-panathenaia')).toBeVisible();
    await expect(page.getByTestId('result-holiday-panathenaia-holiday')).toBeVisible();

    await page.getByTestId('filter-type').selectOption('TRADITION');

    await expect(page).toHaveURL(/type=TRADITION/);
    await expect(page.getByTestId('results-holidays')).toHaveCount(0);
    await expect(page.getByTestId('result-card-panathenaia')).toBeVisible();
  });

  test('a search from the URL is restored, including the text box', async ({ page }) => {
    await page.goto('/search?q=пирамиды');

    await expect(page.getByTestId('search-input')).toHaveValue('пирамиды');
    await expect(page.getByTestId('result-card-great-pyramid')).toBeVisible();
    await expect(page.getByTestId('result-culture-ancient-egypt')).toBeVisible();
  });

  test('filters without words list a culture catalogue', async ({ page }) => {
    await page.goto('/search');

    await page.getByTestId('filter-culture').selectOption({ label: 'Древний Египет' });

    await expect(page.getByTestId('search-total')).toHaveText('Найдено карточек: 15');
    await expect(page.getByTestId('results-cards')).not.toContainText('Древняя Греция');
  });

  test('a custom period with the start after the end is rejected', async ({ page }) => {
    await page.goto('/search?q=храм');

    await page.getByTestId('filter-period').selectOption('custom');
    await page.getByTestId('filter-year-from').fill('-400');
    await page.getByTestId('filter-year-to').fill('-500');

    await expect(page.getByText('Начальный год больше конечного.')).toBeVisible();
    await expect(page.getByTestId('results-cards')).toHaveCount(0);
  });

  test('nothing found', async ({ page }) => {
    await page.goto('/search?q=абракадабра');

    await expect(page.getByTestId('search-nothing')).toBeVisible();
  });
});
