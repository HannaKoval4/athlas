import {
  type AdminCard,
  type AdminCardLink,
  type AdminCardListItem,
  type AdminCardSource,
  type AdminSource,
  type Paginated,
  cardDayIssue,
  periodIssue,
} from '@atlas/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Source } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { cultureRefSelect } from '../cards/cards.service';
import { adminWrite, assertNoIssue } from './admin-errors';
import type {
  AdminCardsQueryDto,
  CardInputDto,
  CardLinkInputDto,
  CardSourceInputDto,
  CardSourcePagesDto,
  SourceInputDto,
} from './dto/cards.dto';

const cardRefSelect = { id: true, slug: true, title: true } as const;

const cardLinkSelect = {
  fromCardId: true,
  toCardId: true,
  relationType: true,
  from: { select: cardRefSelect },
  to: { select: cardRefSelect },
} satisfies Prisma.CardLinkSelect;

const cardSourceSelect = {
  cardId: true,
  sourceId: true,
  pages: true,
  source: { select: { id: true, slug: true, title: true, type: true } },
} satisfies Prisma.CardSourceSelect;

const cardSelect = {
  id: true,
  slug: true,
  type: true,
  title: true,
  summary: true,
  content: true,
  cultureId: true,
  startYear: true,
  endYear: true,
  month: true,
  day: true,
  dateApproximate: true,
  imageUrl: true,
  imageCredit: true,
  booksQuery: true,
  published: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  culture: { select: cultureRefSelect },
  linksFrom: { select: cardLinkSelect },
  linksTo: { select: cardLinkSelect },
  sources: { select: cardSourceSelect, orderBy: { source: { title: 'asc' } } },
} satisfies Prisma.CardSelect;

type CardRow = Prisma.CardGetPayload<{ select: typeof cardSelect }>;

const CARD_NOT_FOUND = 'Card not found';

/**
 * F-18: cards with their links and sources, and the source catalogue.
 * Drafts are hidden from users (BR-06); publishing is a separate action so that a card
 * goes live only when the admin decides. publishedAt is maintained by the database
 * trigger card_published_at_trg (DM-09), so the API never sets it.
 */
@Injectable()
export class AdminCardsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Cards ---------------------------------------------------------------------------------

  async findCards(query: AdminCardsQueryDto): Promise<Paginated<AdminCardListItem>> {
    const where: Prisma.CardWhereInput = {
      cultureId: query.cultureId,
      type: query.type,
      published: query.published,
    };
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.card.findMany({
        where,
        select: {
          ...cardRefSelect,
          type: true,
          startYear: true,
          endYear: true,
          published: true,
          publishedAt: true,
          updatedAt: true,
          culture: { select: cultureRefSelect },
        },
        // Recently edited first: the card the admin just worked on is at the top.
        orderBy: [{ updatedAt: 'desc' }, { title: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.card.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findCard(id: string): Promise<AdminCard> {
    const card = await this.prisma.card.findUnique({ where: { id }, select: cardSelect });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    return toAdminCard(card);
  }

  /** A new card is a draft: it reaches the map and search only after publish (BR-06). */
  async createCard(dto: CardInputDto): Promise<AdminCard> {
    assertCard(dto);
    const card = await adminWrite(
      () => this.prisma.card.create({ data: { ...dto, published: false }, select: cardSelect }),
      { missingReference: 'Unknown culture' },
    );
    return toAdminCard(card);
  }

  /**
   * A card moved to another culture takes its notes along: notes on a card carry the card's
   * culture (DM-07). The note trigger fires on Note.cardId only, so the move is done here,
   * in the same transaction.
   */
  async updateCard(id: string, dto: CardInputDto): Promise<AdminCard> {
    assertCard(dto);
    const card = await adminWrite(
      () =>
        this.prisma.$transaction(async (tx) => {
          const updated = await tx.card.update({
            where: { id },
            data: { ...dto },
            select: cardSelect,
          });
          await tx.note.updateMany({
            where: { cardId: id, cultureId: { not: dto.cultureId } },
            data: { cultureId: dto.cultureId },
          });
          return updated;
        }),
      { notFound: CARD_NOT_FOUND, missingReference: 'Unknown culture' },
    );
    return toAdminCard(card);
  }

  /** DM-09: the trigger stamps publishedAt on publish and clears it on unpublish. */
  async setPublished(id: string, published: boolean): Promise<AdminCard> {
    const card = await adminWrite(
      () => this.prisma.card.update({ where: { id }, data: { published }, select: cardSelect }),
      { notFound: CARD_NOT_FOUND },
    );
    return toAdminCard(card);
  }

  /**
   * Links, sources, views and the user's history go with the card; notes stay with the
   * culture (ON DELETE SET NULL + note trigger), questions lose their "revisit" link.
   */
  async removeCard(id: string): Promise<void> {
    await adminWrite(() => this.prisma.card.delete({ where: { id } }), {
      notFound: CARD_NOT_FOUND,
    });
  }

  // ---- Card links (DM-06, BR-18) -------------------------------------------------------------

  async createLink(dto: CardLinkInputDto): Promise<AdminCardLink> {
    if (dto.fromCardId === dto.toCardId) {
      throw new BadRequestException('A card cannot be linked to itself (BR-18)');
    }
    return adminWrite(
      () => this.prisma.cardLink.create({ data: { ...dto }, select: cardLinkSelect }),
      {
        conflict: 'These cards already have a link of this type (BR-18)',
        missingReference: 'Unknown card',
      },
    );
  }

  async removeLink(key: CardLinkInputDto): Promise<void> {
    await adminWrite(
      () =>
        this.prisma.cardLink.delete({ where: { fromCardId_toCardId_relationType: { ...key } } }),
      { notFound: 'Link not found' },
    );
  }

  // ---- Card sources --------------------------------------------------------------------------

  addCardSource(dto: CardSourceInputDto): Promise<AdminCardSource> {
    return adminWrite(
      () => this.prisma.cardSource.create({ data: { ...dto }, select: cardSourceSelect }),
      {
        conflict: 'The source is already attached to the card',
        missingReference: 'Unknown card or source',
      },
    );
  }

  updateCardSource(
    cardId: string,
    sourceId: string,
    dto: CardSourcePagesDto,
  ): Promise<AdminCardSource> {
    return adminWrite(
      () =>
        this.prisma.cardSource.update({
          where: { cardId_sourceId: { cardId, sourceId } },
          data: { pages: dto.pages },
          select: cardSourceSelect,
        }),
      { notFound: 'The source is not attached to the card' },
    );
  }

  async removeCardSource(cardId: string, sourceId: string): Promise<void> {
    await adminWrite(
      () => this.prisma.cardSource.delete({ where: { cardId_sourceId: { cardId, sourceId } } }),
      { notFound: 'The source is not attached to the card' },
    );
  }

  // ---- Sources -------------------------------------------------------------------------------

  async findSources(): Promise<AdminSource[]> {
    const rows = await this.prisma.source.findMany({
      include: { _count: { select: { cards: true } } },
      orderBy: { title: 'asc' },
    });
    return rows.map(({ _count, ...source }) => toAdminSource(source, _count.cards));
  }

  async createSource(dto: SourceInputDto): Promise<AdminSource> {
    const source = await adminWrite(() => this.prisma.source.create({ data: sourceData(dto) }));
    return toAdminSource(source, 0);
  }

  async updateSource(id: string, dto: SourceInputDto): Promise<AdminSource> {
    const { _count, ...source } = await adminWrite(
      () =>
        this.prisma.source.update({
          where: { id },
          data: sourceData(dto),
          include: { _count: { select: { cards: true } } },
        }),
      { notFound: 'Source not found' },
    );
    return toAdminSource(source, _count.cards);
  }

  /** BR-17: CardSource.sourceId is ON DELETE RESTRICT, so a cited source cannot be deleted. */
  async removeSource(id: string): Promise<void> {
    await adminWrite(() => this.prisma.source.delete({ where: { id } }), {
      notFound: 'Source not found',
      inUse: 'The source is cited by cards; detach it first (BR-17)',
    });
  }
}

function assertCard(dto: CardInputDto): void {
  assertNoIssue(periodIssue(dto.startYear, dto.endYear), 'period');
  assertNoIssue(cardDayIssue(dto.month, dto.day), 'day');
}

function toAdminCard(card: CardRow): AdminCard {
  const { linksFrom, linksTo, publishedAt, createdAt, updatedAt, ...rest } = card;
  return {
    ...rest,
    publishedAt: publishedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    links: [...linksFrom, ...linksTo],
  };
}

function sourceData(dto: SourceInputDto): Prisma.SourceCreateInput {
  return { ...dto, accessedAt: dto.accessedAt ? new Date(dto.accessedAt) : null };
}

function toAdminSource(source: Source, cardCount: number): AdminSource {
  return {
    ...source,
    // A calendar date: the time part is always midnight UTC.
    accessedAt: source.accessedAt?.toISOString().slice(0, 10) ?? null,
    cardCount,
  };
}
