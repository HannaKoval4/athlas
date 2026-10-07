import { VIEW_HISTORY_LIMIT } from '@atlas/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { visibleCards } from '../cards/card-visibility';
import { cardListSelect } from '../cards/cards.service';
import type { ViewedCardDto } from './dto/history.dto';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * BR-20: one row per user and card; a repeated view only moves `viewedAt`.
   * A card the user may not open is reported as 404 (BR-06), so drafts are not revealed.
   */
  async record(userId: string, cardId: string, includeDrafts: boolean): Promise<void> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, ...visibleCards(includeDrafts) },
      select: { id: true },
    });
    if (!card) throw new NotFoundException(`Card ${cardId} not found`);

    const viewedAt = new Date();
    await this.prisma.viewHistory.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: { userId, cardId, viewedAt },
      update: { viewedAt },
    });
  }

  /** BR-20: the latest viewed cards, newest first; cards unpublished since are hidden. */
  async findRecent(userId: string, includeDrafts: boolean): Promise<ViewedCardDto[]> {
    const rows = await this.prisma.viewHistory.findMany({
      where: { userId, card: visibleCards(includeDrafts) },
      select: { viewedAt: true, card: { select: cardListSelect } },
      orderBy: { viewedAt: 'desc' },
      take: VIEW_HISTORY_LIMIT,
    });
    return rows.map(({ card, viewedAt }) => ({ ...card, viewedAt: viewedAt.toISOString() }));
  }
}
