import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { CalendarService, compareHolidays } from './calendar.service';
import type { HolidayDto } from './dto/calendar.dto';

const culture = { id: 'c1', slug: 'ancient-greece', name: 'Древняя Греция', color: '#2F6DB5' };

function holidayRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'h1',
    slug: 'holiday',
    name: 'Праздник',
    description: 'Описание',
    dateType: 'EXACT',
    month: 9,
    day: 12,
    season: null,
    dateNote: null,
    culture: { ...culture, startYear: -800 },
    card: null,
    ...overrides,
  };
}

function holiday(overrides: Partial<HolidayDto>): HolidayDto {
  return {
    id: 'h',
    slug: 'h',
    name: 'Б',
    description: '',
    dateType: 'EXACT',
    month: null,
    day: null,
    season: null,
    dateNote: null,
    culture,
    cardSlug: null,
    ...overrides,
  };
}

describe('CalendarService', () => {
  const prisma = {
    holiday: { findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>() },
    card: { findMany: jest.fn<Promise<unknown[]>, [Record<string, unknown>]>() },
    $queryRaw: jest.fn<Promise<unknown[]>, unknown[]>(),
  };
  const service = new CalendarService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.card.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
  });

  describe('today (F-11, BR-15)', () => {
    it('uses the date sent by the client', async () => {
      prisma.$queryRaw.mockResolvedValue([{ month: 9, day: 12 }]);

      const result = await service.today({ month: 9, day: 12 }, false);

      expect(result.today).toEqual({ month: 9, day: 12 });
      expect(result.date).toEqual({ month: 9, day: 12 });
      expect(prisma.holiday.findMany.mock.calls[0]?.[0]).toMatchObject({
        where: { dateType: 'EXACT', month: 9, day: 12 },
      });
      expect(prisma.card.findMany.mock.calls[0]?.[0]).toMatchObject({
        where: { published: true, month: 9, day: 12 },
      });
    });

    it('falls back to the server date', async () => {
      const result = await service.today({}, false, new Date(2026, 1, 28));

      expect(result.today).toEqual({ month: 2, day: 28 });
    });

    it('shows the nearest following day when today has nothing', async () => {
      prisma.$queryRaw.mockResolvedValue([{ month: 11, day: 4 }]);

      const result = await service.today({ month: 10, day: 7 }, false);

      expect(result).toMatchObject({ today: { month: 10, day: 7 }, date: { month: 11, day: 4 } });
      expect(prisma.card.findMany.mock.calls[0]?.[0]).toMatchObject({
        where: { month: 11, day: 4 },
      });
    });

    it('returns an empty day when nothing is dated at all', async () => {
      const result = await service.today({ month: 1, day: 1 }, false);

      expect(result).toEqual({ today: { month: 1, day: 1 }, date: null, holidays: [], cards: [] });
      expect(prisma.card.findMany).not.toHaveBeenCalled();
    });

    it('lets admins see dated drafts', async () => {
      prisma.$queryRaw.mockResolvedValue([{ month: 9, day: 12 }]);

      await service.today({ month: 9, day: 12 }, true);

      expect(prisma.card.findMany.mock.calls[0]?.[0]).toMatchObject({
        where: { month: 9, day: 12 },
      });
      expect(prisma.card.findMany.mock.calls[0]?.[0]).not.toMatchObject({
        where: { published: true },
      });
    });

    it('marks days of events before 1582 as recalculated', async () => {
      prisma.$queryRaw.mockResolvedValue([{ month: 9, day: 12 }]);
      prisma.card.findMany.mockResolvedValue([
        { title: 'Марафонская битва', startYear: -490, dateApproximate: false, month: 9, day: 12 },
        { title: 'Новое время', startYear: 1922, dateApproximate: false, month: 9, day: 12 },
        { title: 'Спорный день', startYear: 1922, dateApproximate: true, month: 9, day: 12 },
      ]);
      prisma.holiday.findMany.mockResolvedValue([holidayRow()]);

      const result = await service.today({ month: 9, day: 12 }, false);

      expect(result.cards.map((card) => card.approximateDay)).toEqual([true, false, true]);
      expect(result.holidays[0]?.approximateDay).toBe(true);
      expect(result.holidays[0]?.culture).toEqual(culture);
    });

    it.each([
      ['only the month', { month: 9 }],
      ['only the day', { day: 12 }],
      ['31 April', { month: 4, day: 31 }],
      ['30 February', { month: 2, day: 30 }],
    ])('rejects %s', async (_name, query) => {
      await expect(service.today(query, false)).rejects.toThrow(BadRequestException);
    });

    it('accepts 29 February', async () => {
      await expect(service.today({ month: 2, day: 29 }, false)).resolves.toMatchObject({
        today: { month: 2, day: 29 },
      });
    });
  });

  describe('findHolidays (F-10)', () => {
    it('filters a month: exact dates of the month and holidays of its season', async () => {
      await service.findHolidays({ month: 4, cultureId: 'c1' }, false);

      expect(prisma.holiday.findMany.mock.calls[0]?.[0]).toMatchObject({
        where: {
          cultureId: 'c1',
          OR: [
            { dateType: 'EXACT', month: 4 },
            { dateType: 'SEASON', season: 'SPRING' },
          ],
        },
      });
    });

    it('hides the link to a draft card from users (BR-06)', async () => {
      prisma.holiday.findMany.mockResolvedValue([
        holidayRow({ card: { slug: 'draft', published: false } }),
      ]);

      const [forUser] = await service.findHolidays({}, false);
      const [forAdmin] = await service.findHolidays({}, true);

      expect(forUser?.cardSlug).toBeNull();
      expect(forAdmin?.cardSlug).toBe('draft');
    });
  });

  describe('compareHolidays', () => {
    it('orders exact dates, seasons, movable and approximate holidays', () => {
      const sorted = [
        holiday({ name: 'Приблизительный', dateType: 'APPROXIMATE' }),
        holiday({ name: 'Летний', dateType: 'SEASON', season: 'SUMMER' }),
        holiday({ name: 'Подвижный', dateType: 'MOVABLE' }),
        holiday({ name: 'Ноябрь', month: 11, day: 4 }),
        holiday({ name: 'Весенний', dateType: 'SEASON', season: 'SPRING' }),
        holiday({ name: 'Январь', month: 1, day: 31 }),
      ].sort(compareHolidays);

      expect(sorted.map((h) => h.name)).toEqual([
        'Январь',
        'Ноябрь',
        'Весенний',
        'Летний',
        'Подвижный',
        'Приблизительный',
      ]);
    });

    it('orders holidays of the same day by name', () => {
      const sorted = [
        holiday({ name: 'Б', month: 5, day: 1 }),
        holiday({ name: 'А', month: 5, day: 1 }),
      ].sort(compareHolidays);

      expect(sorted.map((h) => h.name)).toEqual(['А', 'Б']);
    });
  });
});
