import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cardsInYear, cardsOverlapping, visibleCards } from './card-visibility';
import type { CardDetailsDto, CardLinkRefDto, CardPageDto } from './dto/card.dto';
import type { CardsQueryDto } from './dto/cards-query.dto';

export const cultureRefSelect = { id: true, slug: true, name: true, color: true } as const;

/** Columns of a card in lists; content and relations are loaded only for the card page. */
export const cardListSelect = {
  id: true,
  slug: true,
  type: true,
  title: true,
  summary: true,
  startYear: true,
  endYear: true,
  dateApproximate: true,
  imageUrl: true,
  published: true,
  culture: { select: cultureRefSelect },
} satisfies Prisma.CardSelect;

const linkedCardSelect = { id: true, slug: true, title: true, type: true } as const;

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Card list with filters (culture, type, year, era) and pagination; ordered chronologically. */
  async findMany(query: CardsQueryDto, includeDrafts: boolean): Promise<CardPageDto> {
    const filters: Prisma.CardWhereInput[] = [visibleCards(includeDrafts)];
    if (query.cultureId) filters.push({ cultureId: query.cultureId });
    if (query.type) filters.push({ type: query.type });
    if (query.year !== undefined) filters.push(cardsInYear(query.year));
    if (query.eraId) {
      const era = await this.prisma.era.findUnique({ where: { id: query.eraId } });
      if (!era) throw new NotFoundException(`Era ${query.eraId} not found`);
      filters.push(cardsOverlapping(era.startYear, era.endYear));
    }
    const where: Prisma.CardWhereInput = { AND: filters };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.card.findMany({
        where,
        select: cardListSelect,
        orderBy: [{ startYear: 'asc' }, { title: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.card.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Card page: the card, its sources and its links in both directions (DM-06).
   * A draft is reported as 404 to users, so its existence is not revealed (BR-06).
   * Links to drafts are hidden from users as well.
   */
  async findBySlug(slug: string, includeDrafts: boolean): Promise<CardDetailsDto> {
    const linkedVisible = visibleCards(includeDrafts);
    const card = await this.prisma.card.findFirst({
      where: { slug, ...visibleCards(includeDrafts) },
      select: {
        ...cardListSelect,
        content: true,
        month: true,
        day: true,
        imageCredit: true,
        publishedAt: true,
        sources: {
          select: { pages: true, source: true },
          orderBy: { source: { title: 'asc' } },
        },
        linksFrom: {
          where: { to: linkedVisible },
          select: { relationType: true, to: { select: linkedCardSelect } },
        },
        linksTo: {
          where: { from: linkedVisible },
          select: { relationType: true, from: { select: linkedCardSelect } },
        },
      },
    });
    if (!card) {
      throw new NotFoundException(`Card "${slug}" not found`);
    }

    const { sources, linksFrom, linksTo, publishedAt, ...rest } = card;
    const links: CardLinkRefDto[] = [
      ...linksFrom.map((link) => ({
        direction: 'outgoing' as const,
        relationType: link.relationType,
        card: link.to,
      })),
      ...linksTo.map((link) => ({
        direction: 'incoming' as const,
        relationType: link.relationType,
        card: link.from,
      })),
    ].sort(
      (a, b) =>
        a.relationType.localeCompare(b.relationType) || a.card.title.localeCompare(b.card.title),
    );

    return {
      ...rest,
      publishedAt: publishedAt?.toISOString() ?? null,
      sources: sources.map(({ pages, source }) => ({
        id: source.id,
        type: source.type,
        title: source.title,
        author: source.author,
        publisher: source.publisher,
        year: source.year,
        url: source.url,
        pages,
      })),
      links,
    };
  }
}
