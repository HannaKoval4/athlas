import { HIGHLIGHT_END, HIGHLIGHT_START, type RegionRef, type SearchResults } from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { CardType, Role } from '../../src/generated/prisma/enums';
import { createCard, createCulture, createHoliday, createRegion, placeCulture } from '../factories';
import { createTestApp, json } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

describe('Search (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let user: TestAgent;
  let admin: TestAgent;
  let greeceId = '';
  let egyptId = '';
  let atticaId = '';

  const server = () => app.getHttpServer();
  const titles = (results: SearchResults) => results.cards.items.map((card) => card.title);

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

  async function search(agent: TestAgent, params: Record<string, string | number>) {
    return json<SearchResults>(await agent.get('/api/search').query(params).expect(200));
  }

  // Greece (-800 .. -146, Attica) and Egypt (-3100 .. -30, no region):
  //   Парфенон      ARTWORK  -447 .. -432  "Храм Афины на акрополе"
  //   Перикл        PERSON   -495 .. -429  content mentions "храм"
  //   Панафинеи     TRADITION -566 .. -400 + holiday "Панафинеи"
  //   Тайный храм   ARTWORK  draft
  //   Пирамиды Гизы ARTIFACT -2600 .. -2500
  //   Симпосий      TRADITION  "Пир-беседа" (a stem "пир" next to the prefix "пирам")
  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();

    const greece = await createCulture(prisma, {
      name: 'Древняя Греция',
      description: 'Цивилизация полисов, родина театра и Олимпийских игр.',
      startYear: -800,
      endYear: -146,
    });
    const egypt = await createCulture(prisma, {
      name: 'Древний Египет',
      description: 'Цивилизация долины Нила, строители пирамид.',
      startYear: -3100,
      endYear: -30,
    });
    greeceId = greece.id;
    egyptId = egypt.id;
    atticaId = (await createRegion(prisma, { name: 'Аттика' })).id;
    await placeCulture(prisma, greeceId, atticaId, { startYear: -800, endYear: -146 });

    await createCard(prisma, greeceId, {
      title: 'Парфенон',
      summary: 'Храм Афины на акрополе.',
      type: CardType.ARTWORK,
      startYear: -447,
      endYear: -432,
    });
    await createCard(prisma, greeceId, {
      title: 'Перикл',
      summary: 'Афинский стратег.',
      content: 'При нём построен главный храм акрополя.',
      type: CardType.PERSON,
      startYear: -495,
      endYear: -429,
    });
    const panathenaia = await createCard(prisma, greeceId, {
      title: 'Панафинеи',
      summary: 'Праздник в честь Афины.',
      type: CardType.TRADITION,
      startYear: -566,
      endYear: -400,
    });
    await createCard(prisma, greeceId, {
      title: 'Тайный храм',
      summary: 'Черновик.',
      type: CardType.ARTWORK,
      published: false,
    });
    await createCard(prisma, egyptId, {
      title: 'Пирамиды Гизы',
      summary: 'Гробницы фараонов.',
      type: CardType.ARTIFACT,
      startYear: -2600,
      endYear: -2500,
    });
    await createCard(prisma, greeceId, {
      title: 'Симпосий',
      summary: 'Пир-беседа после трапезы.',
      type: CardType.TRADITION,
      startYear: -700,
      endYear: -300,
    });
    await createHoliday(prisma, greeceId, {
      name: 'Панафинеи',
      description: 'Праздник в честь богини Афины с шествием на акрополь.',
      cardId: panathenaia.id,
    });

    user = await signIn('reader@example.com');
    admin = await signIn('admin@example.com', Role.ADMIN);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('requires authentication', async () => {
    await request(server()).get('/api/search?q=храм').expect(401);
  });

  describe('text search', () => {
    it('finds other word forms and ranks title matches first', async () => {
      const results = await search(user, { q: 'храмы' });

      // Parthenon has "Храм" in the summary (weight B), Pericles only in the content (C).
      expect(titles(results)).toEqual(['Парфенон', 'Перикл']);
      expect(results.cards.total).toBe(2);
    });

    it('matches the beginning of a word while typing', async () => {
      const results = await search(user, { q: 'парфен' });

      expect(titles(results)).toEqual(['Парфенон']);
    });

    it('marks the found words in the snippet', async () => {
      const [card] = (await search(user, { q: 'акрополе' })).cards.items;

      expect(card?.snippet).toContain(`${HIGHLIGHT_START}акрополе${HIGHLIGHT_END}`);
    });

    it('requires every word', async () => {
      expect(titles(await search(user, { q: 'храм перикл' }))).toEqual(['Перикл']);
    });

    it('finds cultures and holidays too, with the linked card', async () => {
      const results = await search(user, { q: 'панафинеи' });

      expect(titles(results)).toEqual(['Панафинеи']);
      expect(results.holidays).toHaveLength(1);
      expect(results.holidays[0]).toMatchObject({
        name: 'Панафинеи',
        dateType: 'MOVABLE',
        culture: { id: greeceId },
        cardSlug: expect.any(String) as string,
      });

      const cultures = (await search(user, { q: 'пирамид' })).cultures;
      expect(cultures.map((c) => c.name)).toEqual(['Древний Египет']);
    });

    it('ignores tsquery syntax in the input', async () => {
      const results = await search(user, { q: "храм & | !( ':*" });

      expect(results.cards.total).toBe(2);
    });

    it('returns nothing for a query of punctuation only', async () => {
      const results = await search(user, { q: '!!!' });

      expect(results.cards.total).toBe(0);
    });
  });

  describe('visibility (BR-06)', () => {
    it('hides drafts from users and shows them to admins', async () => {
      expect(titles(await search(user, { q: 'тайный' }))).toEqual([]);
      expect(titles(await search(admin, { q: 'тайный' }))).toEqual(['Тайный храм']);
    });
  });

  describe('filters', () => {
    it('by card type: only cards are searched', async () => {
      const results = await search(user, { q: 'панафинеи', type: 'TRADITION' });

      expect(titles(results)).toEqual(['Панафинеи']);
      expect(results.holidays).toEqual([]);
      expect(results.cultures).toEqual([]);
    });

    it('by culture without a text query (catalogue, chronological)', async () => {
      const results = await search(user, { cultureId: greeceId });

      expect(titles(results)).toEqual(['Симпосий', 'Панафинеи', 'Перикл', 'Парфенон']);
    });

    it.each([
      [{ yearFrom: -450, yearTo: -440 }, ['Симпосий', 'Панафинеи', 'Перикл', 'Парфенон']],
      // Boundaries: the Parthenon ends in -432, Pericles in -429.
      [{ yearFrom: -432, yearTo: -432 }, ['Симпосий', 'Панафинеи', 'Перикл', 'Парфенон']],
      [{ yearFrom: -431, yearTo: -431 }, ['Симпосий', 'Панафинеи', 'Перикл']],
      [{ yearFrom: -429, yearTo: -429 }, ['Симпосий', 'Панафинеи', 'Перикл']],
      [{ yearTo: -2550 }, ['Пирамиды Гизы']],
      [{ yearFrom: -300 }, ['Симпосий']],
    ])('by period overlap %j (DM-03)', async (period, expected) => {
      expect(titles(await search(user, period))).toEqual(expected);
    });

    it('by region (through CultureRegion)', async () => {
      const results = await search(user, { regionId: atticaId });

      expect(results.cards.items.every((card) => card.culture.id === greeceId)).toBe(true);
      expect(results.cards.total).toBe(4);
    });

    it('paginates the cards', async () => {
      const page2 = await search(user, { cultureId: greeceId, page: 2, pageSize: 3 });

      expect(page2.cards).toMatchObject({ total: 4, page: 2, pageSize: 3 });
      expect(titles(page2)).toEqual(['Парфенон']);
    });

    it.each([
      ['yearFrom > yearTo', { yearFrom: -400, yearTo: -500 }],
      ['year 0', { yearFrom: 0 }],
      ['unknown type', { type: 'POEM' }],
      ['invalid culture id', { cultureId: 'greece' }],
      ['too long query', { q: 'x'.repeat(101) }],
      ['page 0', { page: 0 }],
    ])('answers 400 for %s', async (_name, params) => {
      await user.get('/api/search').query(params).expect(400);
    });
  });

  it('GET /api/regions lists all regions by name', async () => {
    const regions = json<RegionRef[]>(await user.get('/api/regions').expect(200));

    expect(regions.map((r) => r.name)).toEqual(['Аттика']);
  });
});
