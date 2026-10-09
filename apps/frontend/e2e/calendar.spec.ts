import { expect, userTest as test } from './fixtures.ts';

// Runs against the seeded dev database. Seeded holidays have no exact dates; dated cards:
// 12.09 Battle of Marathon, 27.09 hieroglyphs, 15.07 Rosetta Stone, 04.11 Tutankhamun's tomb.
// The browser clock is fixed, so "today" does not depend on the day the tests run.

test.describe('Calendar and "Today in history"', () => {
  test('today shows the dated card of the day; the day is marked approximate', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 12, 10, 0));
    await page.goto('/calendar');

    const today = page.getByTestId('today-in-history');
    await expect(today.getByTestId('today-caption')).toHaveText('12 сентября');
    const card = today.getByTestId('today-card-battle-of-marathon');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('approximate-day')).toBeVisible();

    await card.getByRole('link', { name: 'Марафонская битва' }).click();
    await expect(page).toHaveURL(/\/cards\/battle-of-marathon$/);
  });

  test('an empty day points to the nearest following date', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 7, 10, 0));
    await page.goto('/calendar');

    await expect(page.getByTestId('today-caption')).toHaveText(
      'На 7 октября в атласе ничего не отмечено. Ближайшая дата – 4 ноября.',
    );
    await expect(page.getByTestId('today-card-tutankhamun-tomb')).toBeVisible();
  });

  test('the main screen has the compact block with a link to the calendar', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 12, 10, 0));
    await page.goto('/');

    const today = page.getByTestId('today-in-history');
    await expect(today.getByTestId('today-card-battle-of-marathon')).toBeVisible();
    await today.getByRole('link', { name: 'Календарь' }).click();
    await expect(page).toHaveURL(/\/calendar$/);
  });

  test('holidays are grouped by date type and inexact dates are explained', async ({ page }) => {
    await page.goto('/calendar');

    const seasonal = page.getByTestId('holiday-group-SEASON');
    const dionysia = seasonal.getByTestId('holiday-great-dionysia');
    await expect(dionysia).toContainText('Сезонный праздник: весна');
    await expect(dionysia.getByTestId('holiday-date-note')).toContainText('элафеболион');
    await expect(
      page.getByTestId('holiday-group-MOVABLE').getByTestId('holiday-panathenaia-holiday'),
    ).toBeVisible();
    await expect(
      page.getByTestId('holiday-group-APPROXIMATE').getByTestId('holiday-wepet-renpet'),
    ).toBeVisible();
  });

  test('a month keeps the holidays of its season; a culture filter narrows them', async ({
    page,
  }) => {
    await page.goto('/calendar');

    await page.getByTestId('calendar-month').selectOption({ label: 'Апрель' });
    await expect(page).toHaveURL(/month=4/);
    await expect(page.getByTestId('calendar-month-hint')).toBeVisible();
    await expect(page.getByTestId('holiday-great-dionysia')).toBeVisible();
    await expect(page.getByTestId('holiday-group-MOVABLE')).toHaveCount(0);

    await page.getByTestId('calendar-culture').selectOption({ label: 'Древний Египет' });
    await expect(page.getByTestId('calendar-empty')).toBeVisible();
  });
});
