import { NotFoundException } from '@nestjs/common';
import type { Era } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { ErasService } from './eras.service';

const era: Era = {
  id: 'era-1',
  slug: 'antiquity',
  name: 'Античность',
  description: 'Описание',
  startYear: -1200,
  endYear: 476,
  sortOrder: 2,
};

describe('ErasService', () => {
  const prisma = {
    era: {
      findMany: jest.fn<Promise<Era[]>, [unknown]>(),
      findUnique: jest.fn<Promise<Era | null>, [unknown]>(),
    },
  };
  const service = new ErasService(prisma as unknown as PrismaService);

  beforeEach(() => {
    prisma.era.findMany.mockReset();
    prisma.era.findUnique.mockReset();
  });

  it('lists eras by sortOrder and exposes only public fields', async () => {
    prisma.era.findMany.mockResolvedValue([era]);

    const result = await service.findAll();

    expect(prisma.era.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: 'asc' }, { startYear: 'asc' }],
    });
    expect(result).toEqual([
      {
        id: 'era-1',
        slug: 'antiquity',
        name: 'Античность',
        description: 'Описание',
        startYear: -1200,
        endYear: 476,
      },
    ]);
  });

  it('finds an era by slug', async () => {
    prisma.era.findUnique.mockResolvedValue(era);

    await expect(service.findBySlug('antiquity')).resolves.toMatchObject({ slug: 'antiquity' });
  });

  it('throws 404 for an unknown slug', async () => {
    prisma.era.findUnique.mockResolvedValue(null);

    await expect(service.findBySlug('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
