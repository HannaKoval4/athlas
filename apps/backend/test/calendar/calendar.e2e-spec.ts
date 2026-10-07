import type { Holiday, TodayInHistory } from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { HolidayDateType, Role, Season } from '../../src/generated/prisma/enums';
import { createCard, createCulture, createHoliday } from '../factories';
import { createTestApp, json } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

describe('Calendar (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let user: TestAgent;
  let admin: TestAgent;
  let greeceId = '';
  let draftSlug = '';

  const server = () => app.getHttpServer();

  async function signIn(email: string, role: Role = Role.USER): Promise<TestAgent> {
    const agent = request.agent(server());
    await agent
      .post('/api/auth/register')
      .send({ email, password: 'Secret123', name: 'Reader', consent: true })
      .expect(201);
    if (role === Role.ADMIN) {
      await prisma.user.update({ where: { email }, data: { role } });
      await agent.post('/api/auth/login').send({ email, password: 'Secret123' }).expect(200);
    }
    return agent;
  }

  async function today(agent: TestAgent, month: number, day: number) {
    return json<TodayInHistory>(
      await agent.get('/api/calendar/today').query({ month, day }).expect(200),
    );
  }

  async function holidays(agent: TestAgent, params: Record<string, string | number> = {}) {
    return json<Holiday[]>(await agent.get('/api/holidays').query(params).expect(200));
  }

  // Dated entries:
  //   08.03  "Мартовский праздник" (EXACT, culture from 1700)
  //   12.09  "Сентябрьский праздник" (EXACT, Greece) + card "Марафонская битва" (-490)
  //          + draft card "Черновик"
  //   04.11  card "Находка гробницы" (1922, exact day)
  // Undated holidays: "Весенний" (SEASON SPRING), "Подвижный" (MOVABLE, linked to the draft),
  // "Приблизительный" (APPROXIMATE).
  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();

    const greece = await createCulture(prisma, { startYear: -800, endYear: -146 });
    const modern = await createCulture(prisma, { startYear: 1700, endYear: 2000 });
    greeceId = greece.id;

    await createCard(prisma, greeceId, {
      title: 'Марафонская битва',
      startYear: -490,
      endYear: -490,
      month: 9,
      day: 12,
    });
    const draft = await createCard(prisma, greeceId, {
      title: 'Черновик',
      month: 9,
      day: 12,
      published: false,
    });
    draftSlug = draft.slug;
    await createCard(prisma, modern.id, {
      title: 'Находка гробницы',
      startYear: 1922,
      endYear: 1922,
      month: 11,
      day: 4,
    });

    await createHoliday(prisma, modern.id, {
      name: 'Мартовский праздник',
      description: 'Точная дата.',
      dateType: HolidayDateType.EXACT,
      month: 3,
      day: 8,
    });
    await createHoliday(prisma, greeceId, {
      name: 'Сентябрьский праздник',
      description: 'Точная дата.',
      dateType: HolidayDateType.EXACT,
      month: 9,
      day: 12,
    });
    await createHoliday(prisma, greeceId, {
      name: 'Весенний',
      description: 'Сезон.',
      dateType: HolidayDateType.SEASON,
      season: Season.SPRING,
    });
    await createHoliday(prisma, greeceId, {
      name: 'Подвижный',
      description: 'По луне.',
      cardId: draft.id,
    });
    await createHoliday(prisma, greeceId, {
      name: 'Приблизительный',
      description: 'Примерно.',
      dateType: HolidayDateType.APPROXIMATE,
    });

    user = await signIn('reader@example.com');
    admin = await signIn('admin@example.com', Role.ADMIN);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it.each(['/api/calendar/today', '/api/holidays'])('%s requires authentication', async (url) => {
    await request(server()).get(url).expect(401);
  });

  describe('GET /calendar/today (F-11, BR-15)', () => {
    it('lists EXACT holidays and published dated cards of the day', async () => {
      const result = await today(user, 9, 12);

      expect(result.today).toEqual({ month: 9, day: 12 });
      expect(result.date).toEqual({ month: 9, day: 12 });
      expect(result.holidays.map((h) => h.name)).toEqual(['Сентябрьский праздник']);
      expect(result.cards.map((c) => c.title)).toEqual(['Марафонская битва']);
    });

    it('marks recalculated days of ancient events as approximate', async () => {
      const ancient = await today(user, 9, 12);
      const modern = await today(user, 11, 4);

      expect(ancient.cards[0]?.approximateDay).toBe(true);
      expect(ancient.holidays[0]?.approximateDay).toBe(true);
      expect(modern.cards[0]).toMatchObject({ title: 'Находка гробницы', approximateDay: false });
    });

    it('shows dated drafts to admins only (BR-06)', async () => {
      const result = await today(admin, 9, 12);

      // Chronological: the draft starts in -500 (factory default).
      expect(result.cards.map((c) => c.title)).toEqual(['Черновик', 'Марафонская битва']);
    });

    it.each([
      ['the day after an entry', [9, 13], { month: 11, day: 4 }],
      ['the end of the year (wraps to January)', [12, 31], { month: 3, day: 8 }],
      ['the first day of the year', [1, 1], { month: 3, day: 8 }],
      ['the day before an entry', [3, 7], { month: 3, day: 8 }],
      ['the day of an entry itself', [3, 8], { month: 3, day: 8 }],
    ])('without entries shows the nearest following day: %s', async (_name, [month, day], date) => {
      const result = await today(user, month ?? 0, day ?? 0);

      expect(result.today).toEqual({ month, day });
      expect(result.date).toEqual(date);
    });

    it('uses the server date without parameters', async () => {
      const result = json<TodayInHistory>(await user.get('/api/calendar/today').expect(200));
      const now = new Date();

      expect(result.today).toEqual({ month: now.getMonth() + 1, day: now.getDate() });
    });

    it.each([
      ['only the month', { month: 9 }],
      ['only the day', { day: 12 }],
      ['30 February', { month: 2, day: 30 }],
      ['month 13', { month: 13, day: 1 }],
      ['day 0', { month: 1, day: 0 }],
      ['a word as the day', { month: 1, day: 'first' }],
    ])('answers 400 for %s', async (_name, query) => {
      await user.get('/api/calendar/today').query(query).expect(400);
    });

    it('accepts 29 February', async () => {
      const result = await today(user, 2, 29);

      expect(result.date).toEqual({ month: 3, day: 8 });
    });
  });

  describe('GET /holidays (F-10)', () => {
    it('lists all holidays in calendar order', async () => {
      const names = (await holidays(user)).map((h) => h.name);

      expect(names).toEqual([
        'Мартовский праздник',
        'Сентябрьский праздник',
        'Весенний',
        'Подвижный',
        'Приблизительный',
      ]);
    });

    it('explains dates that are not exact', async () => {
      const movable = (await holidays(user)).find((h) => h.name === 'Подвижный');

      expect(movable).toMatchObject({
        dateType: 'MOVABLE',
        month: null,
        dateNote: expect.any(String) as string,
      });
    });

    it.each([
      [3, ['Мартовский праздник', 'Весенний']],
      [4, ['Весенний']],
      [9, ['Сентябрьский праздник']],
      [1, []],
    ])('month %d: exact dates of the month and holidays of its season', async (month, names) => {
      expect((await holidays(user, { month })).map((h) => h.name)).toEqual(names);
    });

    it('filters by culture', async () => {
      const result = await holidays(user, { cultureId: greeceId, month: 3 });

      expect(result.map((h) => h.name)).toEqual(['Весенний']);
      expect(result.every((h) => h.culture.id === greeceId)).toBe(true);
    });

    it('links a draft card for admins only (BR-06)', async () => {
      const forUser = (await holidays(user)).find((h) => h.name === 'Подвижный');
      const forAdmin = (await holidays(admin)).find((h) => h.name === 'Подвижный');

      expect(forUser?.cardSlug).toBeNull();
      expect(forAdmin?.cardSlug).toBe(draftSlug);
    });

    it.each([
      ['month 0', { month: 0 }],
      ['month 13', { month: 13 }],
      ['invalid culture id', { cultureId: 'greece' }],
    ])('answers 400 for %s', async (_name, query) => {
      await user.get('/api/holidays').query(query).expect(400);
    });
  });
});
