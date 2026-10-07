import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SearchQueryDto } from './dto/search.dto';
import type { SearchFilters, SearchRepository } from './search.repository';
import { SearchService } from './search.service';

function query(overrides: Partial<SearchQueryDto> = {}): SearchQueryDto {
  return { page: 1, pageSize: 20, ...overrides };
}

describe('SearchService', () => {
  const repository = {
    findCards: jest.fn<
      Promise<{ items: unknown[]; total: number }>,
      [SearchFilters, { skip: number; take: number }]
    >(),
    findCultures: jest.fn<Promise<unknown[]>, [SearchFilters]>(),
    findHolidays: jest.fn<Promise<unknown[]>, [SearchFilters]>(),
  };
  const service = new SearchService(
    repository as unknown as SearchRepository,
    {} as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findCards.mockResolvedValue({ items: [], total: 0 });
    repository.findCultures.mockResolvedValue([]);
    repository.findHolidays.mockResolvedValue([]);
  });

  it('searches cards, cultures and holidays by the words of the query', async () => {
    await service.search(query({ q: 'Храм Афины' }), false);

    const [filters, page] = repository.findCards.mock.calls[0] ?? [];
    expect(filters?.words).toEqual(['храм', 'афины']);
    expect(filters?.includeDrafts).toBe(false);
    expect(page).toEqual({ skip: 0, take: 20 });
    expect(repository.findCultures).toHaveBeenCalled();
    expect(repository.findHolidays).toHaveBeenCalled();
  });

  it('converts the page number into an offset', async () => {
    await service.search(query({ q: 'храм', page: 3, pageSize: 10 }), false);

    expect(repository.findCards.mock.calls[0]?.[1]).toEqual({ skip: 20, take: 10 });
  });

  it('searches only cards when a card type is chosen', async () => {
    await service.search(query({ q: 'храм', type: 'ARTWORK' }), false);

    expect(repository.findCards).toHaveBeenCalled();
    expect(repository.findCultures).not.toHaveBeenCalled();
    expect(repository.findHolidays).not.toHaveBeenCalled();
  });

  it('lists filtered cards without a text query (catalogue)', async () => {
    const result = await service.search(query({ cultureId: 'c-1' }), true);

    expect(repository.findCards.mock.calls[0]?.[0]).toMatchObject({
      words: [],
      cultureId: 'c-1',
      includeDrafts: true,
    });
    expect(repository.findCultures).not.toHaveBeenCalled();
    expect(result.cultures).toEqual([]);
  });

  it('returns nothing for a query without words, instead of every card', async () => {
    const result = await service.search(query({ q: '!!!' }), false);

    expect(repository.findCards).not.toHaveBeenCalled();
    expect(result.cards).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('rejects yearFrom greater than yearTo', async () => {
    await expect(service.search(query({ yearFrom: -400, yearTo: -500 }), false)).rejects.toThrow(
      BadRequestException,
    );
  });
});
