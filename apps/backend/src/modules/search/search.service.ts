import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegionRefDto, SearchQueryDto, SearchResultsDto } from './dto/search.dto';
import { type SearchFilters, SearchRepository } from './search.repository';
import { extractSearchWords } from './ts-query';

@Injectable()
export class SearchService {
  constructor(
    private readonly repository: SearchRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * F-09: cards, cultures and holidays matching the words and the filters.
   * - Without words the search lists the filtered cards (a catalogue); cultures and holidays
   *   are matched by text only.
   * - A card type filter narrows the search to cards.
   */
  async search(query: SearchQueryDto, includeDrafts: boolean): Promise<SearchResultsDto> {
    if (
      query.yearFrom !== undefined &&
      query.yearTo !== undefined &&
      query.yearFrom > query.yearTo
    ) {
      throw new BadRequestException('yearFrom must not be greater than yearTo');
    }

    const words = query.q ? extractSearchWords(query.q) : [];
    if (query.q && words.length === 0) {
      // Only punctuation was typed: nothing can match (and it is not a filter-only search).
      return {
        cards: { items: [], total: 0, page: query.page, pageSize: query.pageSize },
        cultures: [],
        holidays: [],
      };
    }
    const filters: SearchFilters = {
      words,
      type: query.type,
      cultureId: query.cultureId,
      regionId: query.regionId,
      yearFrom: query.yearFrom,
      yearTo: query.yearTo,
      includeDrafts,
    };
    const searchOthers = words.length > 0 && !query.type;

    const [cards, cultures, holidays] = await Promise.all([
      this.repository.findCards(filters, {
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      searchOthers ? this.repository.findCultures(filters) : [],
      searchOthers ? this.repository.findHolidays(filters) : [],
    ]);

    return {
      cards: { ...cards, page: query.page, pageSize: query.pageSize },
      cultures,
      holidays,
    };
  }

  /** All regions for the search filter, by name. */
  findRegions(): Promise<RegionRefDto[]> {
    return this.prisma.region.findMany({
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
