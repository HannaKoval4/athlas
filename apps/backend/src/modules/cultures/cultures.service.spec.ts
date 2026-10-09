import { NotFoundException } from '@nestjs/common';
import type { Culture } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CulturesService } from './cultures.service';

const greece: Culture = {
  id: 'c-1',
  slug: 'ancient-greece',
  name: 'Древняя Греция',
  description: 'Описание',
  startYear: -3000,
  endYear: -146,
  dateApproximate: true,
  color: '#2F6DB5',
  booksQuery: 'Ancient Greece',
};

describe('CulturesService', () => {
  const prisma = {
    culture: {
      findMany: jest.fn<Promise<Culture[]>, [unknown]>(),
      findUnique: jest.fn<Promise<Culture | null>, [unknown]>(),
    },
    card: {
      groupBy: jest.fn<Promise<unknown[]>, [unknown]>(),
      findMany: jest.fn<Promise<unknown[]>, [unknown]>(),
    },
    cardLink: { findMany: jest.fn<Promise<unknown[]>, [unknown]>() },
  };
  const service = new CulturesService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.culture.findUnique.mockResolvedValue(greece);
    prisma.card.groupBy.mockResolvedValue([
      { type: 'MYTHOLOGY', _count: { _all: 2 } },
      { type: 'PERSON', _count: { _all: 1 } },
    ]);
  });

  it('returns counts for every card type, zero included', async () => {
    const result = await service.findBySlug('ancient-greece', { year: -450, includeDrafts: false });

    expect(result.cardCounts).toEqual({
      MYTHOLOGY: 2,
      EVENT: 0,
      TRADITION: 0,
      FACT: 0,
      ARTWORK: 0,
      PERSON: 1,
      ARTIFACT: 0,
    });
    expect(result.totalCards).toBe(3);
    expect(result.year).toBe(-450);
  });

  it('counts only published cards existing in the year for a user (BR-06, DM-03)', async () => {
    await service.findBySlug('ancient-greece', { year: -450, includeDrafts: false });

    expect(prisma.card.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          cultureId: 'c-1',
          published: true,
          startYear: { lte: -450 },
          endYear: { gte: -450 },
        },
      }),
    );
  });

  it('counts drafts for an admin and all years without a year', async () => {
    const result = await service.findBySlug('ancient-greece', { includeDrafts: true });

    expect(prisma.card.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cultureId: 'c-1' } }),
    );
    expect(result.year).toBeNull();
  });

  it('throws 404 for an unknown culture', async () => {
    prisma.culture.findUnique.mockResolvedValueOnce(null);

    await expect(service.findBySlug('atlantis', { includeDrafts: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.card.groupBy).not.toHaveBeenCalled();
  });

  it('lists cultures chronologically', async () => {
    prisma.culture.findMany.mockResolvedValue([greece]);

    const result = await service.findAll();

    expect(prisma.culture.findMany).toHaveBeenCalledWith({
      orderBy: [{ startYear: 'asc' }, { name: 'asc' }],
    });
    expect(result[0]).not.toHaveProperty('description');
  });

  describe('getGraph', () => {
    it('returns the visible cards of the year and only the links between them', async () => {
      prisma.card.findMany.mockResolvedValue([
        { id: 'a', slug: 'a', title: 'A', type: 'MYTHOLOGY', imageUrl: null },
        { id: 'b', slug: 'b', title: 'B', type: 'EVENT', imageUrl: null },
      ]);
      prisma.cardLink.findMany.mockResolvedValue([
        { fromCardId: 'a', toCardId: 'b', relationType: 'RELATED' },
      ]);

      const graph = await service.getGraph('ancient-greece', { year: -450, includeDrafts: false });

      expect(prisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            cultureId: 'c-1',
            published: true,
            startYear: { lte: -450 },
            endYear: { gte: -450 },
          },
        }),
      );
      // Both ends must be among the nodes: links to other cultures or other years are dropped.
      expect(prisma.cardLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fromCardId: { in: ['a', 'b'] }, toCardId: { in: ['a', 'b'] } },
        }),
      );
      expect(graph.edges).toEqual([{ fromId: 'a', toId: 'b', relationType: 'RELATED' }]);
      expect(graph.nodes).toHaveLength(2);
    });

    it('throws 404 for an unknown culture', async () => {
      prisma.culture.findUnique.mockResolvedValueOnce(null);

      await expect(service.getGraph('atlantis', { includeDrafts: false })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
