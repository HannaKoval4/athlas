import { CARD_TYPES, type CardType } from '@atlas/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { cardsInYear, visibleCards } from '../cards/card-visibility';
import type { CultureGraphDto } from './dto/culture-graph.dto';
import {
  type CultureDetailsDto,
  type CultureSummaryDto,
  toCultureSummary,
} from './dto/culture.dto';

@Injectable()
export class CulturesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<CultureSummaryDto[]> {
    const cultures = await this.prisma.culture.findMany({
      orderBy: [{ startYear: 'asc' }, { name: 'asc' }],
    });
    return cultures.map(toCultureSummary);
  }

  /**
   * Culture panel header: the culture plus how many visible cards of each type it has
   * in `year` (or in total without a year). One GROUP BY query instead of seven counts.
   */
  async findBySlug(
    slug: string,
    options: { year?: number; includeDrafts: boolean },
  ): Promise<CultureDetailsDto> {
    const culture = await this.prisma.culture.findUnique({ where: { slug } });
    if (!culture) {
      throw new NotFoundException(`Culture "${slug}" not found`);
    }

    const groups = await this.prisma.card.groupBy({
      by: ['type'],
      where: {
        cultureId: culture.id,
        ...visibleCards(options.includeDrafts),
        ...(options.year === undefined ? {} : cardsInYear(options.year)),
      },
      _count: { _all: true },
    });

    const cardCounts = Object.fromEntries(CARD_TYPES.map((type) => [type, 0])) as Record<
      CardType,
      number
    >;
    for (const group of groups) {
      cardCounts[group.type] = group._count._all;
    }

    return {
      ...toCultureSummary(culture),
      description: culture.description,
      year: options.year ?? null,
      cardCounts,
      totalCards: groups.reduce((sum, group) => sum + group._count._all, 0),
    };
  }

  /**
   * Link graph of the culture panel: the visible cards of the culture (in `year`, or all)
   * and the links whose both ends are among them. Links to other cultures are left out:
   * the graph shows the structure of one culture.
   */
  async getGraph(
    slug: string,
    options: { year?: number; includeDrafts: boolean },
  ): Promise<CultureGraphDto> {
    const culture = await this.prisma.culture.findUnique({ where: { slug }, select: { id: true } });
    if (!culture) {
      throw new NotFoundException(`Culture "${slug}" not found`);
    }

    const nodes = await this.prisma.card.findMany({
      where: {
        cultureId: culture.id,
        ...visibleCards(options.includeDrafts),
        ...(options.year === undefined ? {} : cardsInYear(options.year)),
      },
      select: { id: true, slug: true, title: true, type: true, imageUrl: true },
      orderBy: [{ type: 'asc' }, { startYear: 'asc' }],
    });
    const ids = nodes.map((node) => node.id);
    const links = await this.prisma.cardLink.findMany({
      where: { fromCardId: { in: ids }, toCardId: { in: ids } },
      select: { fromCardId: true, toCardId: true, relationType: true },
    });

    return {
      nodes,
      edges: links.map((link) => ({
        fromId: link.fromCardId,
        toId: link.toCardId,
        relationType: link.relationType,
      })),
    };
  }
}
