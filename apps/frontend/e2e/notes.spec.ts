import { readFile } from 'node:fs/promises';
import { expect, userTest as test } from './fixtures.ts';

// Runs against the seeded dev database. The worker's user is shared with other specs, so every
// test uses its own unique text and looks only for it.
const unique = (label: string) => `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

test.describe('Notes', () => {
  test('card note: add, keep after reload, edit, delete', async ({ page }) => {
    const text = unique('Дорический ордер');
    await page.goto('/cards/parthenon');
    const panel = page.getByTestId('notes-panel');

    await panel.getByTestId('note-add').click();
    await panel.getByTestId('note-title').fill('Архитектура');
    await panel.getByTestId('note-content').fill(`**${text}**`);
    await panel.getByTestId('note-save').click();

    const note = panel.getByTestId('note-item').filter({ hasText: text });
    await expect(note).toBeVisible();
    // Markdown is rendered, not shown as typed.
    await expect(note.locator('strong')).toHaveText(text);
    await expect(panel.getByTestId('note-editor')).toHaveCount(0);

    await page.reload();
    await expect(note).toBeVisible();

    const edited = unique('Ионический ордер');
    await note.getByTestId('note-edit').click();
    await panel.getByTestId('note-content').fill(edited);
    await panel.getByTestId('note-save').click();
    const editedNote = panel.getByTestId('note-item').filter({ hasText: edited });
    await expect(editedNote).toBeVisible();

    await editedNote.getByTestId('note-delete').click();
    await editedNote.getByTestId('note-delete-confirm').click();
    await expect(editedNote).toHaveCount(0);
  });

  test('an empty note is not saved', async ({ page }) => {
    await page.goto('/cards/parthenon');
    const panel = page.getByTestId('notes-panel');

    await panel.getByTestId('note-add').click();
    await panel.getByTestId('note-content').fill('   ');
    await panel.getByTestId('note-save').click();

    await expect(panel.getByText('Заполните поле.')).toBeVisible();
    await expect(panel.getByTestId('note-editor')).toBeVisible();
  });

  test('culture panel lists culture and card notes; notebook groups them; export MD', async ({
    page,
  }) => {
    const cardText = unique('Заметка о Парфеноне');
    const cultureText = unique('Заметка о Греции');

    await page.goto('/cards/parthenon');
    await page.getByTestId('note-add').click();
    await page.getByTestId('note-content').fill(cardText);
    await page.getByTestId('note-save').click();
    await expect(page.getByTestId('notes-list')).toContainText(cardText);

    await page.goto('/cultures/ancient-greece?era=antiquity&year=-450');
    const panel = page.getByTestId('culture-sheet').getByTestId('notes-panel');
    await panel.getByTestId('note-add').click();
    await panel.getByTestId('note-content').fill(cultureText);
    await panel.getByTestId('note-save').click();
    await expect(panel.getByTestId('notes-list')).toContainText(cultureText);
    // A card note is listed in its culture with a link to the card.
    const cardNote = panel.getByTestId('note-item').filter({ hasText: cardText });
    await expect(cardNote.getByRole('link', { name: 'Карточка: Парфенон' })).toBeVisible();

    await page.goto('/notes');
    const greece = page
      .getByTestId('notes-culture-group')
      .filter({ has: page.getByRole('heading', { name: 'Древняя Греция' }) });
    await expect(greece).toContainText(cardText);
    await expect(greece).toContainText(cultureText);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-md').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^atlas-notes-\d{4}-\d{2}-\d{2}\.md$/);
    const markdown = await readFile(await download.path(), 'utf8');
    expect(markdown).toContain('## Древняя Греция');
    expect(markdown).toContain('### Карточка: Парфенон');
    expect(markdown).toContain(cardText);
    expect(markdown).toContain(cultureText);
  });

  test('export PDF from the profile', async ({ page }) => {
    await page.goto('/profile');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-pdf').click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const pdf = await readFile(await download.path());
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  test('the main screen shows the latest notes', async ({ page }) => {
    const text = unique('Последняя заметка');
    await page.goto('/cards/parthenon');
    await page.getByTestId('note-add').click();
    await page.getByTestId('note-content').fill(text);
    await page.getByTestId('note-save').click();
    await expect(page.getByTestId('notes-list')).toContainText(text);

    await page.goto('/?era=antiquity&year=-450');

    const recent = page.getByTestId('recent-notes');
    await expect(recent).toContainText(text);
    await recent.getByRole('link', { name: 'Все заметки' }).click();
    await expect(page).toHaveURL(/\/notes$/);
  });
});
