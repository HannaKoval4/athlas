import { ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = { isAlive: jest.fn<Promise<boolean>, []>() };

  beforeEach(async () => {
    prisma.isAlive.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns status "ok" when the database is reachable', async () => {
    prisma.isAlive.mockResolvedValue(true);

    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('throws 503 when the database is not reachable', async () => {
    prisma.isAlive.mockResolvedValue(false);

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
