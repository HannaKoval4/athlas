import type { Book } from '@atlas/shared';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { BOOKS_CACHE_TTL_MS, booksCacheKey, BooksService } from './books.service';
import type { OpenLibraryClient } from './open-library.client';

const book: Book = {
  key: '/works/OL1W',
  title: 'The Parthenon',
  authors: ['Jenifer Neils'],
  firstPublishYear: 2005,
  coverUrl: null,
  url: 'https://openlibrary.org/works/OL1W',
};
const NOW = new Date('2026-10-09T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('BooksService (BR-16)', () => {
  const prisma = {
    bookCache: {
      findUnique: jest.fn<Promise<unknown>, [unknown]>(),
      upsert: jest.fn<Promise<unknown>, [unknown]>(),
    },
    card: { findFirst: jest.fn<Promise<unknown>, [unknown]>() },
    culture: { findUnique: jest.fn<Promise<unknown>, [unknown]>() },
  };
  const openLibrary = { search: jest.fn<Promise<Book[]>, [string]>() };
  const service = new BooksService(
    prisma as unknown as PrismaService,
    openLibrary as unknown as OpenLibraryClient,
  );
  const cachedAt = (ageMs: number, payload: Book[] = [book]) => ({
    queryKey: booksCacheKey('Parthenon'),
    payload,
    fetchedAt: new Date(NOW.getTime() - ageMs),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.bookCache.findUnique.mockResolvedValue(null);
    openLibrary.search.mockResolvedValue([book]);
    prisma.card.findFirst.mockResolvedValue({ booksQuery: 'Parthenon' });
    prisma.culture.findUnique.mockResolvedValue({ booksQuery: 'Ancient Greece' });
  });

  describe('cache', () => {
    it('asks Open Library on a miss and caches the answer', async () => {
      await expect(service.search('Parthenon', NOW)).resolves.toEqual([book]);

      expect(openLibrary.search).toHaveBeenCalledWith('Parthenon');
      expect(prisma.bookCache.upsert.mock.calls[0]?.[0]).toMatchObject({
        where: { queryKey: 'openlibrary:v1:parthenon' },
        create: { payload: [book], fetchedAt: NOW },
      });
    });

    it('answers from a fresh row without calling the API', async () => {
      prisma.bookCache.findUnique.mockResolvedValue(cachedAt(7 * DAY_MS - 1));

      await expect(service.search('Parthenon', NOW)).resolves.toEqual([book]);
      expect(openLibrary.search).not.toHaveBeenCalled();
    });

    it('refreshes a row that is 7 days old', async () => {
      prisma.bookCache.findUnique.mockResolvedValue(cachedAt(BOOKS_CACHE_TTL_MS, []));

      await expect(service.search('Parthenon', NOW)).resolves.toEqual([book]);
      expect(openLibrary.search).toHaveBeenCalled();
    });

    it('caches an empty answer too', async () => {
      openLibrary.search.mockResolvedValue([]);

      await expect(service.search('Unknown topic', NOW)).resolves.toEqual([]);
      expect(prisma.bookCache.upsert).toHaveBeenCalled();
    });

    it('normalizes the key: case and spaces do not matter', () => {
      expect(booksCacheKey('  Great   Pyramid ')).toBe(booksCacheKey('great pyramid'));
    });
  });

  describe('graceful fallback', () => {
    it('returns an empty list when the API fails and nothing is cached', async () => {
      openLibrary.search.mockRejectedValue(new Error('timeout'));

      await expect(service.search('Parthenon', NOW)).resolves.toEqual([]);
      expect(prisma.bookCache.upsert).not.toHaveBeenCalled();
    });

    it('returns the stale row when the API fails', async () => {
      prisma.bookCache.findUnique.mockResolvedValue(cachedAt(30 * DAY_MS));
      openLibrary.search.mockRejectedValue(new Error('503'));

      await expect(service.search('Parthenon', NOW)).resolves.toEqual([book]);
      expect(prisma.bookCache.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findFor', () => {
    it('searches by the English phrase of the card', async () => {
      await service.findFor({ cardId: 'card-1' }, false, NOW);

      expect(openLibrary.search).toHaveBeenCalledWith('Parthenon');
      expect(prisma.card.findFirst.mock.calls[0]?.[0]).toMatchObject({
        where: { id: 'card-1', published: true },
      });
    });

    it('searches by the phrase of the culture', async () => {
      await service.findFor({ cultureId: 'culture-1' }, false, NOW);

      expect(openLibrary.search).toHaveBeenCalledWith('Ancient Greece');
    });

    it('returns nothing without a phrase and does not call the API', async () => {
      prisma.card.findFirst.mockResolvedValue({ booksQuery: null });

      await expect(service.findFor({ cardId: 'card-1' }, false, NOW)).resolves.toEqual([]);
      expect(openLibrary.search).not.toHaveBeenCalled();
    });

    it('answers 404 for a hidden card', async () => {
      prisma.card.findFirst.mockResolvedValue(null);

      await expect(service.findFor({ cardId: 'draft' }, false, NOW)).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([
      ['neither', {}],
      ['both', { cardId: 'c', cultureId: 'k' }],
    ])('answers 400 for %s of cardId and cultureId', async (_name, query) => {
      await expect(service.findFor(query, false, NOW)).rejects.toThrow(BadRequestException);
    });
  });
});
