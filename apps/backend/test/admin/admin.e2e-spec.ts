import type {
  AdminCard,
  AdminCardListItem,
  AdminCulture,
  AdminCultureRegion,
  AdminEra,
  AdminHoliday,
  AdminQuestion,
  AdminQuiz,
  AdminRegion,
  AdminSource,
  CardDetails,
  CardInput,
  MapSlice,
  Paginated,
  QuestionInput,
  SearchResults,
} from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { CardType, RelationType, Role } from '../../src/generated/prisma/enums';
import {
  createCard,
  createCulture,
  createEra,
  createRegion,
  createUser,
  placeCulture,
} from '../factories';
import { type ErrorBody, createTestApp, json } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

const SQUARE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [10, 40],
      [11, 40],
      [11, 41],
      [10, 40],
    ],
  ],
};

describe('Admin API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let admin: TestAgent;
  let user: TestAgent;
  let sequence = 0;

  const server = () => app.getHttpServer();
  const slug = (prefix: string) => `admin-${prefix}-${++sequence}`;

  async function signIn(email: string, role: Role): Promise<TestAgent> {
    const agent = request.agent(server());
    await agent
      .post('/api/auth/register')
      .send({ email, password: 'Secret123', name: 'Tester', consent: true })
      .expect(201);
    if (role === Role.ADMIN) {
      await prisma.user.update({ where: { email }, data: { role } });
      await agent.post('/api/auth/login').send({ email, password: 'Secret123' }).expect(200);
    }
    return agent;
  }

  function cardInput(cultureId: string, overrides: Partial<CardInput> = {}): CardInput {
    return {
      slug: slug('card'),
      type: CardType.ARTIFACT,
      title: 'Фестский диск',
      summary: 'Глиняный диск с оттиснутыми знаками',
      content: 'Найден в 1908 году.',
      cultureId,
      startYear: -1700,
      endYear: -1600,
      month: null,
      day: null,
      dateApproximate: true,
      imageUrl: null,
      imageCredit: null,
      booksQuery: null,
      ...overrides,
    };
  }

  const message = (res: request.Response) => JSON.stringify(json<ErrorBody>(res).message);

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();
    admin = await signIn('admin@example.com', Role.ADMIN);
    user = await signIn('reader@example.com', Role.USER);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('ADM-01 access (F-18)', () => {
    it.each([
      ['get', '/api/admin/cultures'],
      ['get', '/api/admin/cards'],
      ['post', '/api/admin/eras'],
      ['delete', '/api/admin/sources/00000000-0000-4000-8000-000000000000'],
    ] as const)('%s %s: 401 without a session, 403 for a user', async (method, url) => {
      await request(server())[method](url).expect(401);
      await user[method](url).expect(403);
    });

    it('rejects unknown fields and malformed ids with 400', async () => {
      const culture = await createCulture(prisma);
      await admin
        .post('/api/admin/cards')
        .send({ ...cardInput(culture.id), published: true })
        .expect(400);
      await admin.get('/api/admin/cards/not-a-uuid').expect(400);
    });
  });

  describe('ADM-02 eras', () => {
    const era = () => ({
      slug: slug('era'),
      name: 'Бронзовый век',
      description: null,
      startYear: -3300,
      endYear: -1200,
      sortOrder: 1,
    });

    it('creates, updates and deletes an era', async () => {
      const created = json<AdminEra>(await admin.post('/api/admin/eras').send(era()).expect(201));
      expect(created).toMatchObject({ name: 'Бронзовый век', quizCount: 0 });

      const updated = json<AdminEra>(
        await admin
          .put(`/api/admin/eras/${created.id}`)
          .send({ ...era(), slug: created.slug, name: 'Поздняя бронза', description: '  ' })
          .expect(200),
      );
      expect(updated).toMatchObject({ id: created.id, name: 'Поздняя бронза', description: null });

      await admin.delete(`/api/admin/eras/${created.id}`).expect(204);
      await admin.delete(`/api/admin/eras/${created.id}`).expect(404);
    });

    it.each([
      [{ startYear: -100, endYear: -200 }, 'endBeforeStart'],
      [{ startYear: 0, endYear: 100 }, 'yearZero'],
    ])('rejects the period %p (DM-01, DM-02)', async (period, issue) => {
      const res = await admin
        .post('/api/admin/eras')
        .send({ ...era(), ...period })
        .expect(400);
      expect(message(res)).toContain(issue);
    });

    it('answers 409 to a taken slug', async () => {
      const first = era();
      await admin.post('/api/admin/eras').send(first).expect(201);
      await admin
        .post('/api/admin/eras')
        .send({ ...era(), slug: first.slug })
        .expect(409);
    });

    it('keeps an era that has quizzes (409)', async () => {
      const { id } = await createEra(prisma, { startYear: -800, endYear: -500 });
      const culture = await createCulture(prisma);
      await prisma.quiz.create({ data: { eraId: id, cultureId: culture.id, title: 'Quiz' } });

      const res = await admin.delete(`/api/admin/eras/${id}`).expect(409);
      expect(message(res)).toContain('quiz');
    });
  });

  describe('ADM-03 cultures, regions and the time slice', () => {
    it('BR-17: a culture with cards cannot be deleted', async () => {
      const culture = await createCulture(prisma);
      await createCard(prisma, culture.id);

      const res = await admin.delete(`/api/admin/cultures/${culture.id}`).expect(409);
      expect(message(res)).toContain('BR-17');
    });

    it('deletes a culture without cards with its regions and holidays', async () => {
      const culture = await createCulture(prisma);
      const region = await createRegion(prisma);
      await placeCulture(prisma, culture.id, region.id, { startYear: -900, endYear: -800 });

      await admin.delete(`/api/admin/cultures/${culture.id}`).expect(204);
      expect(await prisma.cultureRegion.count({ where: { cultureId: culture.id } })).toBe(0);
    });

    it('validates the colour and the GeoJSON of a region (DM-10)', async () => {
      await admin
        .post('/api/admin/cultures')
        .send({
          slug: slug('culture'),
          name: 'Минойская цивилизация',
          description: 'Крит',
          startYear: -2700,
          endYear: -1450,
          dateApproximate: true,
          color: 'red',
        })
        .expect(400);
      const res = await admin
        .post('/api/admin/regions')
        .send({
          slug: slug('region'),
          name: 'Крит',
          geojson: { type: 'Point', coordinates: [24, 35] },
          centerLat: 35.2,
          centerLng: 24.9,
        })
        .expect(400);
      expect(message(res)).toContain('geojson');
    });

    it('a new culture, region and period appear on the map once a card is published', async () => {
      const culture = json<AdminCulture>(
        await admin
          .post('/api/admin/cultures')
          .send({
            slug: slug('culture'),
            name: 'Минойская цивилизация',
            description: 'Бронзовый век Крита',
            startYear: -2700,
            endYear: -1450,
            dateApproximate: true,
            color: '#0e7490',
            booksQuery: 'Minoan civilization',
          })
          .expect(201),
      );
      const region = json<AdminRegion>(
        await admin
          .post('/api/admin/regions')
          .send({
            slug: slug('region'),
            name: 'Крит',
            geojson: SQUARE,
            centerLat: 35.2,
            centerLng: 24.9,
          })
          .expect(201),
      );
      const period = json<AdminCultureRegion>(
        await admin
          .post('/api/admin/culture-regions')
          .send({
            cultureId: culture.id,
            regionId: region.id,
            startYear: -2000,
            endYear: -1450,
            dateApproximate: true,
          })
          .expect(201),
      );
      expect(period.region).toEqual({ id: region.id, slug: region.slug, name: 'Крит' });

      const onMap = async () =>
        json<MapSlice>(await user.get('/api/map?year=-1600').expect(200)).regions.map((r) => r.id);
      // BR-04: no published card yet, so the region is not lit.
      expect(await onMap()).not.toContain(region.id);

      const card = json<AdminCard>(
        await admin.post('/api/admin/cards').send(cardInput(culture.id)).expect(201),
      );
      await admin.post(`/api/admin/cards/${card.id}/publish`).expect(200);
      expect(await onMap()).toContain(region.id);
    });

    it('answers 409 to a second period with the same start and 400 to an unknown region', async () => {
      const culture = await createCulture(prisma);
      const region = await createRegion(prisma);
      const body = {
        cultureId: culture.id,
        regionId: region.id,
        startYear: -900,
        endYear: -800,
        dateApproximate: false,
      };
      await admin.post('/api/admin/culture-regions').send(body).expect(201);
      await admin.post('/api/admin/culture-regions').send(body).expect(409);
      await admin
        .post('/api/admin/culture-regions')
        .send({ ...body, regionId: '00000000-0000-4000-8000-000000000000' })
        .expect(400);
    });
  });

  describe('ADM-04 cards and publishing (BR-06, DM-09)', () => {
    let cultureId = '';

    beforeAll(async () => {
      cultureId = (await createCulture(prisma)).id;
    });

    it('creates a draft that users cannot see', async () => {
      const card = json<AdminCard>(
        await admin.post('/api/admin/cards').send(cardInput(cultureId)).expect(201),
      );
      expect(card).toMatchObject({ published: false, publishedAt: null, links: [], sources: [] });
      await user.get(`/api/cards/${card.slug}`).expect(404);
      await admin.get(`/api/cards/${card.slug}`).expect(200);
    });

    it('publish stamps publishedAt, the card is found by search; unpublish hides it again', async () => {
      const input = cardInput(cultureId, { title: 'Лабрис', summary: 'Двойной топор' });
      const { id } = json<AdminCard>(await admin.post('/api/admin/cards').send(input).expect(201));

      const published = json<AdminCard>(
        await admin.post(`/api/admin/cards/${id}/publish`).expect(200),
      );
      expect(published.published).toBe(true);
      expect(Date.parse(published.publishedAt ?? '')).toBeGreaterThan(Date.now() - 60_000);

      const search = json<SearchResults>(
        await user.get(`/api/search?q=${encodeURIComponent('Лабрис')}`).expect(200),
      );
      expect(search.cards.items.map((c) => c.id)).toContain(id);

      const unpublished = json<AdminCard>(
        await admin.post(`/api/admin/cards/${id}/unpublish`).expect(200),
      );
      expect(unpublished).toMatchObject({ published: false, publishedAt: null });
      await user.get(`/api/cards/${input.slug}`).expect(404);
    });

    it.each([
      [{ startYear: -1500, endYear: -1600 }, 'endBeforeStart'],
      [{ month: 2, day: null }, 'dayIncomplete'],
      [{ month: 4, day: 31 }, 'dayInvalid'],
    ])('rejects %p', async (overrides, issue) => {
      const res = await admin
        .post('/api/admin/cards')
        .send(cardInput(cultureId, overrides))
        .expect(400);
      expect(message(res)).toContain(issue);
    });

    it('answers 400 to an unknown culture and 404 to an unknown card', async () => {
      await admin
        .post('/api/admin/cards')
        .send(cardInput('00000000-0000-4000-8000-000000000000'))
        .expect(400);
      const missing = '00000000-0000-4000-8000-000000000000';
      await admin.put(`/api/admin/cards/${missing}`).send(cardInput(cultureId)).expect(404);
      await admin.post(`/api/admin/cards/${missing}/publish`).expect(404);
    });

    it('lists drafts and published cards with filters', async () => {
      const own = await createCulture(prisma);
      await createCard(prisma, own.id, { title: 'Опубликована' });
      await createCard(prisma, own.id, { title: 'Черновик', published: false });

      const page = (query: string) =>
        admin
          .get(`/api/admin/cards?cultureId=${own.id}&${query}`)
          .expect(200)
          .then((res) => json<Paginated<AdminCardListItem>>(res));
      expect((await page('')).total).toBe(2);
      expect((await page('published=false')).items.map((c) => c.title)).toEqual(['Черновик']);
      expect((await page('q=%D0%BE%D0%BF%D1%83%D0%B1')).items.map((c) => c.title)).toEqual([
        'Опубликована',
      ]);
    });

    it('moving a card to another culture moves its notes (DM-07)', async () => {
      const other = await createCulture(prisma);
      const card = await createCard(prisma, cultureId);
      const reader = await createUser(prisma);
      const note = await prisma.note.create({
        data: { userId: reader.id, cardId: card.id, content: 'Заметка' },
      });

      await admin
        .put(`/api/admin/cards/${card.id}`)
        .send(cardInput(other.id, { slug: card.slug }))
        .expect(200);
      expect((await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).cultureId).toBe(
        other.id,
      );
    });

    it('deleting a card keeps the notes on its culture', async () => {
      const card = await createCard(prisma, cultureId);
      const reader = await createUser(prisma);
      const note = await prisma.note.create({
        data: { userId: reader.id, cardId: card.id, content: 'Заметка' },
      });

      await admin.delete(`/api/admin/cards/${card.id}`).expect(204);
      expect(await prisma.note.findUniqueOrThrow({ where: { id: note.id } })).toMatchObject({
        cardId: null,
        cultureId,
      });
    });
  });

  describe('ADM-05 card links (BR-18)', () => {
    it('creates a link shown on both cards, rejects self and duplicate links', async () => {
      const culture = await createCulture(prisma);
      const myth = await createCard(prisma, culture.id);
      const vase = await createCard(prisma, culture.id);
      const link = { fromCardId: vase.id, toCardId: myth.id, relationType: RelationType.DEPICTS };

      await admin.post('/api/admin/card-links').send(link).expect(201);
      await admin.post('/api/admin/card-links').send(link).expect(409);
      await admin
        .post('/api/admin/card-links')
        .send({ ...link, toCardId: vase.id })
        .expect(400);

      const fromMyth = json<AdminCard>(await admin.get(`/api/admin/cards/${myth.id}`).expect(200));
      expect(fromMyth.links).toMatchObject([{ from: { id: vase.id }, to: { id: myth.id } }]);
      const publicVase = json<CardDetails>(await user.get(`/api/cards/${vase.slug}`).expect(200));
      expect(publicVase.links.map((l) => l.card.id)).toEqual([myth.id]);

      const path = `/api/admin/card-links/${vase.id}/${myth.id}/DEPICTS`;
      await admin.delete(path).expect(204);
      await admin.delete(path).expect(404);
      await admin.delete(`/api/admin/card-links/${vase.id}/${myth.id}/NOPE`).expect(400);
    });
  });

  describe('ADM-06 sources (BR-17)', () => {
    it('a cited source cannot be deleted until it is detached', async () => {
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);
      const source = json<AdminSource>(
        await admin
          .post('/api/admin/sources')
          .send({
            slug: slug('source'),
            type: 'ENCYCLOPEDIA',
            title: 'Britannica: Phaistos Disk',
            url: 'https://www.britannica.com/topic/Phaistos-Disk',
            accessedAt: '2026-10-01',
          })
          .expect(201),
      );
      expect(source).toMatchObject({
        author: null,
        year: null,
        accessedAt: '2026-10-01',
        cardCount: 0,
      });

      const link = { cardId: card.id, sourceId: source.id, pages: 'с. 12' };
      await admin.post('/api/admin/card-sources').send(link).expect(201);
      await admin.post('/api/admin/card-sources').send(link).expect(409);
      await admin
        .put(`/api/admin/card-sources/${card.id}/${source.id}`)
        .send({ pages: 'с. 14' })
        .expect(200);

      const res = await admin.delete(`/api/admin/sources/${source.id}`).expect(409);
      expect(message(res)).toContain('BR-17');

      await admin.delete(`/api/admin/card-sources/${card.id}/${source.id}`).expect(204);
      await admin.delete(`/api/admin/sources/${source.id}`).expect(204);
    });

    it('rejects a non-http URL', async () => {
      await admin
        .post('/api/admin/sources')
        .send({ slug: slug('source'), type: 'WEBSITE', title: 'Site', url: 'javascript:alert(1)' })
        .expect(400);
    });
  });

  describe('ADM-07 holidays (DM-05)', () => {
    let cultureId = '';

    beforeAll(async () => {
      cultureId = (await createCulture(prisma)).id;
    });

    const holiday = (overrides: Record<string, unknown>) => ({
      slug: slug('holiday'),
      cultureId,
      name: 'Праздник',
      description: 'Описание',
      dateType: 'EXACT',
      ...overrides,
    });

    it.each([
      [{ dateType: 'EXACT' }, 'exactNeedsDay'],
      [{ dateType: 'EXACT', month: 2, day: 30 }, 'dayInvalid'],
      [{ dateType: 'SEASON' }, 'seasonNeedsSeason'],
      [{ dateType: 'MOVABLE', month: 3, day: 1 }, 'dayOnlyForExact'],
    ])('rejects %p', async (overrides, issue) => {
      const res = await admin.post('/api/admin/holidays').send(holiday(overrides)).expect(400);
      expect(message(res)).toContain(issue);
    });

    it('a new EXACT holiday is in the calendar right away', async () => {
      const created = json<AdminHoliday>(
        await admin
          .post('/api/admin/holidays')
          .send(holiday({ name: 'Новый праздник', month: 7, day: 14 }))
          .expect(201),
      );
      expect(created).toMatchObject({ season: null, dateNote: null, cardId: null });

      const calendar = json<{ name: string }[]>(
        await user.get('/api/holidays?month=7').expect(200),
      );
      expect(calendar.map((h) => h.name)).toContain('Новый праздник');

      await admin
        .put(`/api/admin/holidays/${created.id}`)
        .send(
          holiday({
            slug: created.slug,
            dateType: 'SEASON',
            season: 'SUMMER',
            dateNote: 'По солнцу',
          }),
        )
        .expect(200);
      await admin.delete(`/api/admin/holidays/${created.id}`).expect(204);
    });
  });

  describe('ADM-08 quizzes and questions', () => {
    let quiz: AdminQuiz;

    beforeAll(async () => {
      const era = await createEra(prisma, { startYear: -2000, endYear: -1000 });
      const culture = await createCulture(prisma);
      quiz = json<AdminQuiz>(
        await admin
          .post('/api/admin/quizzes')
          .send({
            eraId: era.id,
            cultureId: culture.id,
            title: 'Крит',
            questionsPerAttempt: 10,
            passPercent: 70,
          })
          .expect(201),
      );
    });

    const question = (overrides: Partial<QuestionInput> = {}): QuestionInput => ({
      quizId: quiz.id,
      text: 'Где нашли Фестский диск?',
      explanation: 'В Фестском дворце на Крите.',
      multiple: false,
      cardId: null,
      options: [
        { text: 'Фест', isCorrect: true },
        { text: 'Кносс', isCorrect: false },
      ],
      ...overrides,
    });

    it('answers 409 to a second quiz for the same era and culture (DM-08)', async () => {
      await admin
        .post('/api/admin/quizzes')
        .send({
          eraId: quiz.eraId,
          cultureId: quiz.cultureId,
          title: 'Дубль',
          questionsPerAttempt: 5,
          passPercent: 70,
        })
        .expect(409);
    });

    it.each([
      [{ options: [{ text: 'Фест', isCorrect: true }] }, 'tooFewOptions'],
      [
        {
          options: [
            { text: 'Фест', isCorrect: true },
            { text: 'Кносс', isCorrect: true },
          ],
        },
        'singleNeedsOneCorrect',
      ],
    ])('rejects an invalid option set %#', async (overrides, issue) => {
      const res = await admin.post('/api/admin/questions').send(question(overrides)).expect(400);
      expect(message(res)).toContain(issue);
    });

    it('edits options in place: kept ids survive, new ones are added, missing ones removed', async () => {
      const created = json<AdminQuestion>(
        await admin.post('/api/admin/questions').send(question()).expect(201),
      );
      const fest = created.options.find((o) => o.text === 'Фест');
      expect(fest).toBeDefined();

      const updated = json<AdminQuestion>(
        await admin
          .put(`/api/admin/questions/${created.id}`)
          .send(
            question({
              multiple: true,
              options: [
                { id: fest?.id, text: 'Фест (Крит)', isCorrect: true },
                { text: 'Агия-Триада', isCorrect: true },
                { text: 'Микены', isCorrect: false },
              ],
            }),
          )
          .expect(200),
      );
      expect(updated.options.map((o) => o.text)).toEqual(['Агия-Триада', 'Микены', 'Фест (Крит)']);
      expect(updated.options.find((o) => o.text === 'Фест (Крит)')?.id).toBe(fest?.id);

      const list = json<AdminQuestion[]>(
        await admin.get(`/api/admin/questions?quizId=${quiz.id}`).expect(200),
      );
      expect(list.map((q) => q.id)).toContain(created.id);
      const quizzes = json<AdminQuiz[]>(await admin.get('/api/admin/quizzes').expect(200));
      expect(quizzes.find((q) => q.id === quiz.id)?.questionCount).toBe(1);
    });

    it('rejects an option id of another question', async () => {
      const a = json<AdminQuestion>(
        await admin.post('/api/admin/questions').send(question()).expect(201),
      );
      const b = json<AdminQuestion>(
        await admin.post('/api/admin/questions').send(question()).expect(201),
      );
      const foreign = b.options[0]?.id;

      await admin
        .put(`/api/admin/questions/${a.id}`)
        .send(
          question({
            options: [
              { id: foreign, text: 'Фест', isCorrect: true },
              { text: 'Кносс', isCorrect: false },
            ],
          }),
        )
        .expect(400);

      await admin.delete(`/api/admin/questions/${a.id}`).expect(204);
      await admin.delete(`/api/admin/questions/${a.id}`).expect(404);
    });
  });
});
