import type { Book } from '@atlas/shared';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { visibleCards } from '../cards/card-visibility';
import type { BooksQueryDto } from './dto/books.dto';
import { OpenLibraryClient } from './open-library.client';

/** BR-16: a cached answer is reused for 7 days. */
export const BOOKS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Cache key of a search phrase; the version prefix lets a format change skip old rows. */
export function booksCacheKey(query: string): string {
  return `openlibrary:v1:${query.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openLibrary: OpenLibraryClient,
  ) {}

  /**
   * F-14 "Books on the topic" of one card or one culture (BR-16). The search phrase is the
   * entity's English `booksQuery`; without it there is nothing to search and the block is hidden.
   */
  async findFor(query: BooksQueryDto, includeDrafts: boolean, now = new Date()): Promise<Book[]> {
    if (Boolean(query.cardId) === Boolean(query.cultureId)) {
      throw new BadRequestException('Give exactly one of cardId and cultureId');
    }
    const phrase = query.cardId
      ? await this.cardQuery(query.cardId, includeDrafts)
      : await this.cultureQuery(query.cultureId ?? '');
    return phrase ? this.search(phrase, now) : [];
  }

  /**
   * Cache first: a fresh row (younger than 7 days) answers without calling Open Library.
   * Otherwise the API is asked and the answer, even an empty one, is cached.
   * When the API fails, the stale row is better than nothing; without one the list is empty
   * and the page hides the block. Errors are never cached, so the next view tries again.
   */
  async search(phrase: string, now = new Date()): Promise<Book[]> {
    const queryKey = booksCacheKey(phrase);
    const cached = await this.prisma.bookCache.findUnique({ where: { queryKey } });
    if (cached && now.getTime() - cached.fetchedAt.getTime() < BOOKS_CACHE_TTL_MS) {
      return cached.payload as unknown as Book[];
    }

    let books: Book[];
    try {
      books = await this.openLibrary.search(phrase);
    } catch (error) {
      this.logger.warn(`Open Library is unavailable for "${phrase}": ${String(error)}`);
      return cached ? (cached.payload as unknown as Book[]) : [];
    }

    const payload = books as unknown as Prisma.InputJsonValue;
    await this.prisma.bookCache.upsert({
      where: { queryKey },
      create: { queryKey, payload, fetchedAt: now },
      update: { payload, fetchedAt: now },
    });
    return books;
  }

  /** A draft is 404 for users, like the card page itself (BR-06). */
  private async cardQuery(cardId: string, includeDrafts: boolean): Promise<string | null> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, ...visibleCards(includeDrafts) },
      select: { booksQuery: true },
    });
    if (!card) throw new NotFoundException(`Card ${cardId} not found`);
    return card.booksQuery;
  }

  private async cultureQuery(cultureId: string): Promise<string | null> {
    const culture = await this.prisma.culture.findUnique({
      where: { id: cultureId },
      select: { booksQuery: true },
    });
    if (!culture) throw new NotFoundException(`Culture ${cultureId} not found`);
    return culture.booksQuery;
  }
}
