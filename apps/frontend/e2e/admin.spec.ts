import { adminTest, expect, userTest } from './fixtures.ts';

// Runs against the seeded dev database. The created card is deleted at the end of the test,
// so the atlas content stays as seeded.

adminTest.describe('Admin (F-18)', () => {
  adminTest(
    'E2E-03: create a card, publish it, find it by search and see it on the map',
    async ({ page }) => {
      const token = `xk${Date.now().toString(36)}`;
      const title = `Тестовая находка ${token}`;
      const slug = `testovaya-nakhodka-${token}`;

      await page.goto('/');
      await page.getByTestId('nav-admin').click();
      await expect(page).toHaveURL(/\/admin\/cards$/);

      await page.getByTestId('admin-add').click();
      await expect(page).toHaveURL(/\/admin\/cards\/new$/);
      await page.getByTestId('admin-field-title').fill(title);
      await page.getByTestId('admin-field-title').blur();
      // The slug is suggested from the Russian title.
      await expect(page.getByTestId('admin-field-slug')).toHaveValue(slug);
      await page.getByTestId('admin-field-type').selectOption('EVENT');
      await page.getByTestId('admin-field-cultureId').selectOption({ label: 'Древняя Греция' });
      await page.getByTestId('admin-field-summary').fill('Карточка из автотеста админки');
      await page.getByTestId('admin-field-content').fill(`Текст карточки **${token}**.`);
      await page.getByTestId('admin-field-startYear').fill('-450');
      await page.getByTestId('admin-field-endYear').fill('-440');
      await page.getByTestId('admin-save').click();

      // A new card is a draft and continues on its own page.
      await expect(page).toHaveURL(/\/admin\/cards\/[0-9a-f-]{36}$/);
      await expect(page.getByTestId('admin-card-status')).toHaveText('Черновик');
      const adminUrl = page.url();

      await page.getByTestId('admin-publish').click();
      await expect(page.getByTestId('admin-card-status')).toHaveText('Опубликована');

      await page.goto(`/search?q=${token}`);
      const result = page.getByTestId(`result-card-${slug}`);
      await expect(result).toBeVisible();

      await result.getByRole('link', { name: 'На карте' }).click();
      await expect(page).toHaveURL(/\/cultures\/ancient-greece\?/);
      await page.getByTestId('tab-EVENT').click();
      await expect(page.getByTestId(`card-link-${slug}`)).toBeVisible();

      // Clean up: delete the card through the admin page.
      await page.goto(adminUrl);
      await page.getByTestId('admin-delete').click();
      await page.getByTestId('admin-delete-confirm').click();
      await expect(page).toHaveURL(/\/admin\/cards$/);
      await page.goto(`/search?q=${token}`);
      await expect(page.getByTestId('search-nothing')).toBeVisible();
    },
  );

  adminTest('the card form checks the period before saving (DM-02)', async ({ page }) => {
    await page.goto('/admin/cards/new');
    await page.getByTestId('admin-field-startYear').fill('-400');
    await page.getByTestId('admin-field-endYear').fill('-450');
    await page.getByTestId('admin-save').click();

    await expect(page.getByText('Год окончания раньше года начала.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/cards\/new$/);
  });

  adminTest('a culture with cards is not deleted (BR-17)', async ({ page }) => {
    await page.goto('/admin/cultures');
    const greece = page.getByTestId('admin-row').filter({ hasText: 'Древняя Греция' });
    await greece.getByTestId('admin-delete').click();
    await greece.getByTestId('admin-delete-confirm').click();

    await expect(greece.getByRole('alert')).toContainText('Конфликт');
    await expect(greece).toBeVisible();
  });
});

userTest('a user has no admin menu and gets 404 at /admin', async ({ page }) => {
  // The profile page is light, so the header is there quickly even on a cold dev server.
  await page.goto('/profile');
  await expect(page.getByTestId('current-user-name')).toBeVisible();
  await expect(page.getByTestId('nav-admin')).toHaveCount(0);

  await page.goto('/admin/cards');
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
});
