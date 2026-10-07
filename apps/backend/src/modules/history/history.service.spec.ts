import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { HistoryService } from './history.service';

describe('HistoryService (BR-20)', () => {
  const prisma = {
    card: { findFirst: jest.fn<Promise<unknown>, [Record<string, unknown>]>() },
    viewHistory: {
      upsert: jest.fn<Promise<unknown>, [Record<string, unknown>]>(),
      findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>(),
    },
  };
  const service = new HistoryService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.card.findFirst.mockResolvedValue({ id: 'card-1' });
  });

  it('keeps one row per card: a repeated view updates viewedAt', async () => {
    await service.record('user-1', 'card-1', false);

    const args = prisma.viewHistory.upsert.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      where: { userId_cardId: { userId: 'user-1', cardId: 'card-1' } },
      create: { userId: 'user-1', cardId: 'card-1' },
    });
    expect(args?.update).toEqual({ viewedAt: expect.any(Date) as Date });
  });

  it('answers 404 for a card the user may not open', async () => {
    prisma.card.findFirst.mockResolvedValue(null);

    await expect(service.record('user-1', 'draft', false)).rejects.toThrow(NotFoundException);
    expect(prisma.card.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'draft', published: true },
    });
    expect(prisma.viewHistory.upsert).not.toHaveBeenCalled();
  });

  it('lists the latest 20 visible cards, newest first', async () => {
    const viewedAt = new Date('2026-10-07T10:00:00Z');
    prisma.viewHistory.findMany.mockResolvedValue([{ viewedAt, card: { id: 'card-1' } }]);

    const result = await service.findRecent('user-1', false);

    expect(prisma.viewHistory.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { userId: 'user-1', card: { published: true } },
      orderBy: { viewedAt: 'desc' },
      take: 20,
    });
    expect(result).toEqual([{ id: 'card-1', viewedAt: '2026-10-07T10:00:00.000Z' }]);
  });
});
