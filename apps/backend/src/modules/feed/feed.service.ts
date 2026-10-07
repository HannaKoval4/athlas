import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { cardListSelect } from '../cards/cards.service';
import type { FeedCardDto } from './dto/feed.dto';

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * F-13 "New in the atlas": the latest published cards (DM-09). Drafts are left out for
   * admins too: the feed shows what readers see.
   */
  async findNew(limit: number): Promise<FeedCardDto[]> {
    const cards = await this.prisma.card.findMany({
      where: { published: true, publishedAt: { not: null } },
      select: { ...cardListSelect, publishedAt: true },
      orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
      take: limit,
    });
    return cards.map(({ publishedAt, ...card }) => ({
      ...card,
      // Never null here: filtered in the query.
      publishedAt: (publishedAt ?? new Date(0)).toISOString(),
    }));
  }
}
