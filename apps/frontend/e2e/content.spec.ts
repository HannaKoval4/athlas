import { expect, userTest as test } from './fixtures.ts';

// Runs against the seeded dev database (Ancient Greece: 15 cards; in -450 seven of them exist).
// The Parthenon (ARTWORK, -447 .. -432) depicts the Panathenaia; Pericles is related to it.

test.describe('Culture panel and cards', () => {
  test('map → region → culture → card → related card → back', async ({ page }) => {
    await page.goto('/?era=antiquity&year=-450');
    await page.getByTestId('region-crete').click();
    await page.getByRole('link', { name: 'Древняя Греция' }).click();

    const sheet = page.getByTestId('culture-sheet');
    await expect(page).toHaveURL(/\/cultures\/ancient-greece\?era=antiquity&year=-450$/);
    await expect(sheet).toContainText('датировка приблизительная');
    await expect(page.getByTestId('culture-card-total')).toHaveText(/450.*: 7$/);
    // The Parthenon was built after -450: no artworks in that year.
    await expect(page.getByTestId('tab-ARTWORK')).toBeDisabled();

    await page.getByTestId('show-all-switch').click();
    await expect(page).toHaveURL(/all=1/);
    await expect(page.getByTestId('culture-card-total')).toHaveText(/: 15$/);
    await page.getByTestId('tab-ARTWORK').click();
    await page.getByTestId('card-link-parthenon').click();

    await expect(page).toHaveURL(/\/cards\/parthenon$/);
    await expect(page.getByTestId('card-title')).toHaveText('Парфенон');
    await expect(page.getByTestId('card-type')).toHaveText('Произведение');
    await expect(page.getByTestId('card-sources').locator('li')).not.toHaveCount(0);
    await expect(page.getByTestId('related-cards')).toContainText('Изображает: Панафинеи');
    await expect(page.getByTestId('related-cards')).toContainText('Связано с: Перикл');

    await page.getByTestId('related-panathenaia').click();
    await expect(page).toHaveURL(/\/cards\/panathenaia$/);
    await expect(page.getByTestId('related-cards')).toContainText('Изображено в: Парфенон');

    await page.getByRole('button', { name: 'Назад' }).click();
    await expect(page).toHaveURL(/\/cards\/parthenon$/);
  });

  test('closing the panel returns to the same map view', async ({ page }) => {
    await page.goto('/cultures/ancient-greece?era=antiquity&year=-450');
    await expect(page.getByTestId('culture-sheet')).toBeVisible();

    await page.getByRole('button', { name: 'Закрыть панель культуры' }).click();

    await expect(page).toHaveURL(/\/\?era=antiquity&year=-450$/);
    await expect(page.getByTestId('culture-sheet')).toHaveCount(0);
  });

  test('the active tab is kept in the URL and survives a reload', async ({ page }) => {
    await page.goto('/cultures/ancient-greece?era=antiquity&year=-450&type=PERSON');

    await expect(page.getByTestId('tab-PERSON')).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByTestId('tab-PERSON')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('card-link-socrates')).toBeVisible();
  });

  test('"Show on the map" opens the culture at the card year', async ({ page }) => {
    await page.goto('/cards/parthenon');

    await page.getByTestId('show-on-map').click();

    // The era is derived from the year.
    await expect(page).toHaveURL(/\/cultures\/ancient-greece\?year=-447&era=antiquity$/);
    await expect(page.getByTestId('culture-card-total')).toHaveText(/447/);
  });

  test('the gallery shows illustrated cards and opens a card', async ({ page }) => {
    await page.goto('/cultures/ancient-greece?era=antiquity&year=-450&all=1');

    const gallery = page.getByTestId('culture-gallery');
    await expect(gallery.locator('img')).not.toHaveCount(0);
    await page.getByRole('button', { name: 'Прокрутить галерею вперёд' }).click();
    await gallery.getByTestId('gallery-parthenon').click();

    await expect(page).toHaveURL(/\/cards\/parthenon$/);
    await expect(page.getByRole('img', { name: 'Парфенон' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute(
      'href',
      /commons\.wikimedia\.org/,
    );
  });

  test('the link graph highlights neighbours and opens a card from the keyboard', async ({
    page,
  }) => {
    await page.goto('/cultures/ancient-greece?era=antiquity&year=-450&all=1');
    await page.getByTestId('view-graph').click();
    await expect(page).toHaveURL(/view=graph/);

    const parthenon = page.getByTestId('graph-node-parthenon');
    await parthenon.locator('circle').hover();
    // Neighbours stay bright, unrelated cards are dimmed.
    await expect(page.getByTestId('graph-node-panathenaia')).toHaveAttribute('opacity', '1');
    await expect(page.getByTestId('graph-node-socrates')).toHaveAttribute('opacity', '0.3');

    await parthenon.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/cards\/parthenon$/);
  });

  test('an unknown card shows "not found"', async ({ page }) => {
    await page.goto('/cards/no-such-card');

    await expect(page.getByRole('heading', { name: 'Карточка не найдена.' })).toBeVisible();
  });
});
