import type { Book } from '@atlas/shared';
import { expect, userTest as test } from './fixtures.ts';

// The browser's /api/books answers are replaced: the UI test must not depend on Open Library
// (the backend side, with a local stub of the service, is covered by the API e2e tests).

const BOOKS: Book[] = [
  {
    key: '/works/OL4290372W',
    title: 'The Parthenon',
    authors: ['Jenifer Neils'],
    firstPublishYear: 2005,
    coverUrl: null,
    url: 'https://openlibrary.org/works/OL4290372W',
  },
  {
    key: '/works/OL2522719W',
    title: 'The Parthenon frieze',
    authors: ['Ian Jenkins'],
    firstPublishYear: 1994,
    coverUrl: null,
    url: 'https://openlibrary.org/works/OL2522719W',
  },
];

test.describe('Books on the topic (Open Library)', () => {
  test('the card page lists books with links to Open Library', async ({ page }) => {
    await page.route(/\/api\/books\?/, (route) => route.fulfill({ json: BOOKS }));
    await page.goto('/cards/parthenon');

    const books = page.getByTestId('books');
    await expect(books.getByRole('heading', { name: 'Книги по теме' })).toBeVisible();
    await expect(books.getByTestId('book')).toHaveCount(2);
    await expect(books.getByRole('link', { name: /The Parthenon frieze/ })).toHaveAttribute(
      'href',
      'https://openlibrary.org/works/OL2522719W',
    );
    await expect(books).toContainText('первое издание – 2005');
  });

  test('the block is hidden when the books are unavailable; the page still works', async ({
    page,
  }) => {
    await page.route(/\/api\/books\?/, (route) => route.fulfill({ status: 500, json: {} }));
    await page.goto('/cards/parthenon');

    await expect(page.getByRole('heading', { level: 1, name: 'Парфенон' })).toBeVisible();
    await expect(page.getByTestId('card-page')).toContainText('Источники');
    await expect(page.getByTestId('books')).toHaveCount(0);
  });

  test('the culture panel shows books for the culture', async ({ page }) => {
    await page.route(/\/api\/books\?cultureId=/, (route) => route.fulfill({ json: BOOKS }));
    await page.goto('/cultures/ancient-greece?era=antiquity&year=-450');

    await expect(page.getByTestId('culture-sheet').getByTestId('book')).toHaveCount(2);
  });
});
