import type { FeedCard, RandomTopic, ViewedCard } from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { Role } from '../../src/generated/prisma/enums';
import { createCard, createCulture, createEra } from '../factories';
import { createTestApp, json } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

describe('Random topic, feed and view history (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let reader: TestAgent;
  let admin: TestAgent;

  const server = () => app.getHttpServer();
  const ids: Record<string, string> = {};

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

  async function userId(email: string): Promise<string> {
    return (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
  }

  /** A finished, passed attempt of the quiz of the pair (BR-08 priority). */
  async function passQuiz(email: string, pair: string): Promise<void> {
    await prisma.quizAttempt.create({
      data: {
        userId: await userId(email),
        quizId: ids[pair] ?? '',
        questionIds: [],
        total: 10,
        score: 10,
        passed: true,
        finishedAt: new Date(),
      },
    });
  }

  async function randomTopics(agent: TestAgent, times: number): Promise<RandomTopic[]> {
    const topics: RandomTopic[] = [];
    for (let i = 0; i < times; i++) {
      topics.push(json<RandomTopic>(await agent.get('/api/random-topic').expect(200)));
    }
    return topics;
  }

  const pairOf = (topic: RandomTopic) => `${topic.era.slug}/${topic.culture.name}`;

  // Eras: ancient (-3000 .. -801), antiquity (-800 .. 476), middle-ages (477 .. 1000).
  // Cultures: Greece (-800 .. -146), Egypt (-3100 .. -30), "Empty" (-500 .. -100, a draft only).
  // Filled pairs: ancient/Egypt, antiquity/Greece, antiquity/Egypt. Each has a quiz.
  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();

    const ancient = await createEra(prisma, {
      slug: 'ancient',
      startYear: -3000,
      endYear: -801,
      sortOrder: 0,
    });
    const antiquity = await createEra(prisma, {
      slug: 'antiquity',
      startYear: -800,
      endYear: 476,
      sortOrder: 1,
    });
    await createEra(prisma, { slug: 'middle-ages', startYear: 477, endYear: 1000, sortOrder: 2 });

    const greece = await createCulture(prisma, { name: 'Греция', startYear: -800, endYear: -146 });
    const egypt = await createCulture(prisma, { name: 'Египет', startYear: -3100, endYear: -30 });
    const empty = await createCulture(prisma, { name: 'Пустая', startYear: -500, endYear: -100 });

    const day = (n: number) => new Date(Date.UTC(2026, 9, n));
    const parthenon = await createCard(prisma, greece.id, {
      title: 'Парфенон',
      startYear: -447,
      endYear: -432,
    });
    const pyramid = await createCard(prisma, egypt.id, {
      title: 'Пирамида',
      startYear: -2600,
      endYear: -2500,
    });
    const ptolemy = await createCard(prisma, egypt.id, {
      title: 'Птолемеи',
      startYear: -305,
      endYear: -30,
    });
    const draft = await createCard(prisma, empty.id, { title: 'Черновик', published: false });
    const noDate = await createCard(prisma, greece.id, { title: 'Без даты публикации' });
    await prisma.card.update({ where: { id: parthenon.id }, data: { publishedAt: day(1) } });
    await prisma.card.update({ where: { id: pyramid.id }, data: { publishedAt: day(3) } });
    await prisma.card.update({ where: { id: ptolemy.id }, data: { publishedAt: day(2) } });
    Object.assign(ids, {
      parthenon: parthenon.id,
      pyramid: pyramid.id,
      draft: draft.id,
      noDate: noDate.id,
    });

    for (const [key, eraId, cultureId] of [
      ['ancient/Египет', ancient.id, egypt.id],
      ['antiquity/Греция', antiquity.id, greece.id],
      ['antiquity/Египет', antiquity.id, egypt.id],
    ] as const) {
      ids[key] = (await prisma.quiz.create({ data: { eraId, cultureId, title: key } })).id;
    }

    reader = await signIn('reader@example.com');
    admin = await signIn('admin@example.com', Role.ADMIN);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it.each([
    ['GET', '/api/random-topic'],
    ['GET', '/api/feed/new'],
    ['GET', '/api/users/me/history'],
    ['POST', '/api/users/me/history'],
  ])('%s %s requires authentication', async (method, url) => {
    const agent = request(server());
    await (method === 'GET' ? agent.get(url) : agent.post(url)).expect(401);
  });

  describe('GET /random-topic (F-12, BR-08)', () => {
    it('chooses only pairs with published cards in the period intersection', async () => {
      const agent = await signIn('random@example.com');
      const pairs = new Set((await randomTopics(agent, 40)).map(pairOf));

      // Empty culture (a draft only) and the middle ages (no cards) are never chosen.
      expect([...pairs].sort()).toEqual(['ancient/Египет', 'antiquity/Греция', 'antiquity/Египет']);
    });

    it('explains the choice and opens the map inside both periods', async () => {
      const topics = await randomTopics(reader, 20);
      const egypt = topics.find((topic) => pairOf(topic) === 'antiquity/Египет');

      expect(egypt).toMatchObject({ cardsCount: 1, quizStatus: 'NOT_PASSED' });
      for (const topic of topics) {
        expect(topic.year).toBeGreaterThanOrEqual(topic.era.slug === 'ancient' ? -3000 : -800);
        expect(topic.year).toBeLessThanOrEqual(topic.era.slug === 'ancient' ? -801 : -30);
      }
    });

    it('skips pairs whose quiz the user has passed', async () => {
      const agent = await signIn('passed-one@example.com');
      await passQuiz('passed-one@example.com', 'antiquity/Греция');

      const pairs = (await randomTopics(agent, 30)).map(pairOf);

      expect(pairs).not.toContain('antiquity/Греция');
    });

    it('chooses among all pairs once every quiz is passed', async () => {
      const agent = await signIn('passed-all@example.com');
      for (const pair of ['ancient/Египет', 'antiquity/Греция', 'antiquity/Египет']) {
        await passQuiz('passed-all@example.com', pair);
      }

      const [topic] = await randomTopics(agent, 1);

      expect(topic).toMatchObject({ quizStatus: 'PASSED', allQuizzesPassed: true });
    });
  });

  describe('GET /feed/new (F-13, DM-09)', () => {
    it('lists published cards, newest first', async () => {
      const feed = json<FeedCard[]>(await admin.get('/api/feed/new').expect(200));

      // The draft and the card without publishedAt are left out, for admins too.
      expect(feed.map((card) => card.title)).toEqual(['Пирамида', 'Птолемеи', 'Парфенон']);
      expect(feed[0]?.publishedAt).toBe('2026-10-03T00:00:00.000Z');
    });

    it('limits the number of cards', async () => {
      const feed = json<FeedCard[]>(await reader.get('/api/feed/new?limit=2').expect(200));

      expect(feed.map((card) => card.title)).toEqual(['Пирамида', 'Птолемеи']);
    });

    it.each(['0', '51', 'ten'])('answers 400 for limit=%s', async (limit) => {
      await reader.get('/api/feed/new').query({ limit }).expect(400);
    });
  });

  describe('/users/me/history (BR-20)', () => {
    async function history(agent: TestAgent) {
      return json<ViewedCard[]>(await agent.get('/api/users/me/history').expect(200));
    }

    async function view(agent: TestAgent, cardId: string, status = 204) {
      await agent.post('/api/users/me/history').send({ cardId }).expect(status);
    }

    it('records views, newest first, one row per card', async () => {
      const agent = await signIn('viewer@example.com');

      await view(agent, ids.parthenon ?? '');
      await view(agent, ids.pyramid ?? '');
      await view(agent, ids.parthenon ?? '');

      const cards = await history(agent);
      expect(cards.map((card) => card.title)).toEqual(['Парфенон', 'Пирамида']);
      expect(Date.parse(cards[0]?.viewedAt ?? '')).toBeGreaterThanOrEqual(
        Date.parse(cards[1]?.viewedAt ?? ''),
      );
    });

    it('is private: another user has an empty history', async () => {
      const agent = await signIn('other-viewer@example.com');

      expect(await history(agent)).toEqual([]);
    });

    it('hides drafts from users (404) and records them for admins', async () => {
      await view(reader, ids.draft ?? '', 404);
      await view(admin, ids.draft ?? '');

      expect((await history(admin)).map((card) => card.title)).toContain('Черновик');
    });

    it('hides a card that was unpublished after the view', async () => {
      const agent = await signIn('unpublish@example.com');
      await view(agent, ids.noDate ?? '');
      await prisma.card.update({ where: { id: ids.noDate }, data: { published: false } });

      expect(await history(agent)).toEqual([]);
      await prisma.card.update({ where: { id: ids.noDate }, data: { published: true } });
    });

    it('keeps the latest 20 cards', async () => {
      const agent = await signIn('many@example.com');
      const culture = await createCulture(prisma);
      const cards = [];
      for (let i = 0; i < 21; i++) cards.push(await createCard(prisma, culture.id));
      for (const card of cards) await view(agent, card.id);

      const result = await history(agent);

      expect(result).toHaveLength(20);
      expect(result[0]?.id).toBe(cards[20]?.id);
      expect(result.map((card) => card.id)).not.toContain(cards[0]?.id);
    });

    it.each([
      ['an unknown card', { cardId: '00000000-0000-4000-8000-000000000000' }, 404],
      ['an invalid id', { cardId: 'parthenon' }, 400],
      ['no id', {}, 400],
    ])('answers for %s', async (_name, body, status) => {
      await reader.post('/api/users/me/history').send(body).expect(status);
    });
  });
});
