import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { CardsService } from './cards.service';
import type { CardsQueryDto } from './dto/cards-query.dto';

const culture = { id: 'c-1', slug: 'ancient-greece', name: 'Древняя Греция', color: '#2F6DB5' };

const parthenonRow = {
  id: 'card-1',
  slug: 'parthenon',
  type: 'ARTWORK',
  title: 'Парфенон',
  summary: 'Храм',
  startYear: -447,
  endYear: -432,
  dateApproximate: false,
  imageUrl: null,
  published: true,
  culture,
  content: 'Текст',
  month: null,
  day: null,
  imageCredit: null,
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  sources: [
    {
      pages: '12-14',
      source: {
        id: 's-1',
        slug: 'cartledge',
        type: 'BOOK',
        title: 'Cambridge History',
        author: 'Cartledge P.',
        publisher: 'CUP',
        year: 1998,
        url: null,
        accessedAt: null,
      },
    },
  ],
  linksFrom: [
    {
      relationType: 'DEPICTS',
      to: { id: 'card-2', slug: 'panathenaia', title: 'Панафинеи', type: 'TRADITION' },
    },
  ],
  linksTo: [
    {
      relationType: 'RELATED',
      from: { id: 'card-3', slug: 'pericles', title: 'Перикл', type: 'PERSON' },
    },
  ],
};

function query(overrides: Partial<CardsQueryDto> = {}): CardsQueryDto {
  return { page: 1, pageSize: 20, ...overrides };
}

describe('CardsService', () => {
  const prisma = {
    card: {
      findMany: jest.fn<Promise<unknown>, [unknown]>(),
      count: jest.fn<Promise<unknown>, [unknown]>(),
      findFirst: jest.fn<Promise<unknown>, [unknown]>(),
    },
    era: { findUnique: jest.fn<Promise<unknown>, [unknown]>() },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const service = new CardsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.card.findMany.mockResolvedValue([]);
    prisma.card.count.mockResolvedValue(0);
  });

  describe('findMany', () => {
    it('combines filters and paginates (page 3 of 10 -> skip 20)', async () => {
      prisma.card.count.mockResolvedValue(25);

      const result = await service.findMany(
        query({ cultureId: 'c-1', type: 'ARTWORK', year: -440, page: 3, pageSize: 10 }),
        false,
      );

      expect(prisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { published: true },
              { cultureId: 'c-1' },
              { type: 'ARTWORK' },
              { startYear: { lte: -440 }, endYear: { gte: -440 } },
            ],
          },
          skip: 20,
          take: 10,
          orderBy: [{ startYear: 'asc' }, { title: 'asc' }],
        }),
      );
      expect(result).toEqual({ items: [], total: 25, page: 3, pageSize: 10 });
    });

    it('lets an admin see drafts (BR-06)', async () => {
      await service.findMany(query(), true);

      expect(prisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [{}] } }),
      );
    });

    it('filters by era overlap (DM-03)', async () => {
      prisma.era.findUnique.mockResolvedValue({ id: 'e-1', startYear: -1200, endYear: 476 });

      await service.findMany(query({ eraId: 'e-1' }), false);

      expect(prisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{ published: true }, { startYear: { lte: 476 }, endYear: { gte: -1200 } }],
          },
        }),
      );
    });

    it('throws 404 for an unknown era', async () => {
      prisma.era.findUnique.mockResolvedValue(null);

      await expect(service.findMany(query({ eraId: 'e-404' }), false)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findBySlug', () => {
    it('returns sources and links in both directions (DM-06)', async () => {
      prisma.card.findFirst.mockResolvedValue(parthenonRow);

      const card = await service.findBySlug('parthenon', false);

      expect(card.links).toEqual([
        {
          direction: 'outgoing',
          relationType: 'DEPICTS',
          card: { id: 'card-2', slug: 'panathenaia', title: 'Панафинеи', type: 'TRADITION' },
        },
        {
          direction: 'incoming',
          relationType: 'RELATED',
          card: { id: 'card-3', slug: 'pericles', title: 'Перикл', type: 'PERSON' },
        },
      ]);
      expect(card.sources).toEqual([
        {
          id: 's-1',
          type: 'BOOK',
          title: 'Cambridge History',
          author: 'Cartledge P.',
          publisher: 'CUP',
          year: 1998,
          url: null,
          pages: '12-14',
        },
      ]);
      expect(card.publishedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(card).not.toHaveProperty('linksFrom');
    });

    it('asks only for published cards and links for a user (BR-06)', async () => {
      prisma.card.findFirst.mockResolvedValue(parthenonRow);

      await service.findBySlug('parthenon', false);

      const args = prisma.card.findFirst.mock.calls[0][0] as {
        where: unknown;
        select: { linksFrom: { where: unknown }; linksTo: { where: unknown } };
      };
      expect(args.where).toEqual({ slug: 'parthenon', published: true });
      expect(args.select.linksFrom.where).toEqual({ to: { published: true } });
      expect(args.select.linksTo.where).toEqual({ from: { published: true } });
    });

    it('throws 404 when the card is missing or a draft (BR-06)', async () => {
      prisma.card.findFirst.mockResolvedValue(null);

      await expect(service.findBySlug('draft-card', false)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
