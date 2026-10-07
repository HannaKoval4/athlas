import type {
  CardDetails,
  CardListItem,
  CultureDetails,
  CultureGraph,
  Paginated,
} from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { CardType, RelationType, Role } from '../../src/generated/prisma/enums';
import { createCard, createCulture, createEra, createSource } from '../factories';
import { createTestApp, json } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

describe('Cultures and cards (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let user: TestAgent;
  let admin: TestAgent;

  // Fixture culture (-1000 .. -100):
  //   myth     MYTHOLOGY  -800 .. -200   links: myth -> temple (DEPICTS is temple -> myth)
  //   temple   ARTWORK    -450 .. -430   sources: 2
  //   battle   EVENT      -490 .. -490
  //   hero     PERSON     -500 .. -429   links to the draft (hidden from users)
  //   draft    FACT       -450 .. -450   unpublished
  const c: Record<string, { id: string; slug: string }> = {};
  let cultureId = '';
  let cultureSlug = '';
  let eraId = '';

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

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();

    const culture = await createCulture(prisma);
    cultureId = culture.id;
    cultureSlug = culture.slug;
    eraId = (await createEra(prisma, { startYear: -480, endYear: -470 })).id;

    c.myth = await createCard(prisma, cultureId, {
      type: CardType.MYTHOLOGY,
      title: 'Myth',
      startYear: -800,
      endYear: -200,
    });
    c.temple = await createCard(prisma, cultureId, {
      type: CardType.ARTWORK,
      title: 'Temple',
      startYear: -450,
      endYear: -430,
    });
    c.battle = await createCard(prisma, cultureId, {
      type: CardType.EVENT,
      title: 'Battle',
      startYear: -490,
      endYear: -490,
    });
    c.hero = await createCard(prisma, cultureId, {
      type: CardType.PERSON,
      title: 'Hero',
      startYear: -500,
      endYear: -429,
    });
    c.draft = await createCard(prisma, cultureId, {
      type: CardType.FACT,
      title: 'Draft',
      startYear: -450,
      endYear: -450,
      published: false,
    });

    await prisma.cardLink.createMany({
      data: [
        { fromCardId: c.temple.id, toCardId: c.myth.id, relationType: RelationType.DEPICTS },
        { fromCardId: c.hero.id, toCardId: c.temple.id, relationType: RelationType.RELATED },
        { fromCardId: c.hero.id, toCardId: c.draft.id, relationType: RelationType.RELATED },
      ],
    });
    const [s1, s2] = [await createSource(prisma), await createSource(prisma)];
    await prisma.cardSource.createMany({
      data: [
        { cardId: c.temple.id, sourceId: s1.id, pages: '10-12' },
        { cardId: c.temple.id, sourceId: s2.id },
      ],
    });

    user = await signIn('reader@example.com');
    admin = await signIn('admin@example.com', Role.ADMIN);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /api/cultures/:slug', () => {
    it('counts the cards existing in the year by type (DM-03, BR-06)', async () => {
      const res = await user.get(`/api/cultures/${cultureSlug}?year=-450`).expect(200);
      const culture = json<CultureDetails>(res);

      // -450: myth, temple, hero; battle (-490) is over, the draft is hidden.
      expect(culture.cardCounts).toEqual({
        MYTHOLOGY: 1,
        EVENT: 0,
        TRADITION: 0,
        FACT: 0,
        ARTWORK: 1,
        PERSON: 1,
        ARTIFACT: 0,
      });
      expect(culture.totalCards).toBe(3);
      expect(culture.year).toBe(-450);
    });

    it('counts all published cards without a year', async () => {
      const culture = json<CultureDetails>(
        await user.get(`/api/cultures/${cultureSlug}`).expect(200),
      );

      expect(culture.totalCards).toBe(4);
      expect(culture.year).toBeNull();
    });

    it('counts drafts for an admin (BR-06)', async () => {
      const culture = json<CultureDetails>(
        await admin.get(`/api/cultures/${cultureSlug}?year=-450`).expect(200),
      );

      expect(culture.cardCounts.FACT).toBe(1);
    });

    it('returns 404 for an unknown culture and 400 for year 0', async () => {
      await user.get('/api/cultures/atlantis').expect(404);
      await user.get(`/api/cultures/${cultureSlug}?year=0`).expect(400);
    });

    it('lists all cultures', async () => {
      const res = await user.get('/api/cultures').expect(200);

      expect(json<unknown[]>(res)).toHaveLength(1);
    });
  });

  describe('GET /api/cultures/:slug/graph', () => {
    it('returns the cards of the year and the links among them (DM-06)', async () => {
      const res = await user.get(`/api/cultures/${cultureSlug}/graph?year=-450`).expect(200);
      const graph = json<CultureGraph>(res);

      // -450: myth, temple, hero. hero -> draft is hidden (BR-06); temple -> myth, hero -> temple stay.
      expect(graph.nodes.map((n) => n.slug).sort()).toEqual(
        [c.myth.slug, c.temple.slug, c.hero.slug].sort(),
      );
      expect(graph.edges).toHaveLength(2);
      expect(graph.edges).toContainEqual({
        fromId: c.temple.id,
        toId: c.myth.id,
        relationType: 'DEPICTS',
      });
    });

    it('includes the draft and its link for an admin', async () => {
      const res = await admin.get(`/api/cultures/${cultureSlug}/graph?year=-450`).expect(200);

      expect(json<CultureGraph>(res).edges).toHaveLength(3);
    });

    it('returns 404 for an unknown culture', async () => {
      await user.get('/api/cultures/atlantis/graph').expect(404);
    });
  });

  describe('GET /api/cards', () => {
    const list = (agent: TestAgent, query: string) =>
      agent
        .get(`/api/cards?${query}`)
        .expect(200)
        .then((res) => json<Paginated<CardListItem>>(res));

    it('filters by culture and year, ordered chronologically', async () => {
      const page = await list(user, `cultureId=${cultureId}&year=-450`);

      expect(page.items.map((card) => card.title)).toEqual(['Myth', 'Hero', 'Temple']);
      expect(page.total).toBe(3);
    });

    it('filters by type', async () => {
      const page = await list(user, `cultureId=${cultureId}&type=EVENT`);

      expect(page.items.map((card) => card.title)).toEqual(['Battle']);
    });

    it('includes both period bounds (DM-03)', async () => {
      expect((await list(user, 'year=-430')).items.map((card) => card.title)).toContain('Temple');
      expect((await list(user, 'year=-429')).items.map((card) => card.title)).not.toContain(
        'Temple',
      );
    });

    it('filters by era overlap', async () => {
      // Era -480 .. -470: myth and hero overlap it; battle (-490) and temple (-450) do not.
      const page = await list(user, `eraId=${eraId}`);

      expect(page.items.map((card) => card.title)).toEqual(['Myth', 'Hero']);
    });

    it('paginates with total, page and pageSize', async () => {
      // Published, chronological: Myth (-800), Hero (-500), Battle (-490), Temple (-450).
      const second = await list(user, 'pageSize=2&page=2');

      expect(second).toMatchObject({ total: 4, page: 2, pageSize: 2 });
      expect(second.items.map((card) => card.title)).toEqual(['Battle', 'Temple']);
    });

    it('hides drafts from users and shows them to admins (BR-06)', async () => {
      expect((await list(user, 'type=FACT')).total).toBe(0);
      const adminPage = await list(admin, 'type=FACT');
      expect(adminPage.items).toMatchObject([{ title: 'Draft', published: false }]);
    });

    it.each([
      'type=SPELL',
      'cultureId=not-a-uuid',
      'year=0',
      'page=0',
      'pageSize=101',
      'unknown=1',
    ])('rejects %p with 400', async (query) => {
      await user.get(`/api/cards?${query}`).expect(400);
    });

    it('returns 404 for an unknown era', async () => {
      await user.get('/api/cards?eraId=00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('requires a session', async () => {
      await request(server()).get('/api/cards').expect(401);
      await request(server()).get(`/api/cultures/${cultureSlug}`).expect(401);
    });
  });

  describe('GET /api/cards/:slug', () => {
    it('returns the card with sources and links in both directions (DM-06)', async () => {
      const card = json<CardDetails>(await user.get(`/api/cards/${c.temple.slug}`).expect(200));

      expect(card.title).toBe('Temple');
      expect(card.content).toBe('Content');
      expect(card.sources).toHaveLength(2);
      expect(card.sources.map((s) => s.pages).sort()).toEqual(['10-12', null].sort());
      expect(card.links).toEqual([
        {
          direction: 'outgoing',
          relationType: 'DEPICTS',
          card: expect.objectContaining({ slug: c.myth.slug }) as unknown,
        },
        {
          direction: 'incoming',
          relationType: 'RELATED',
          card: expect.objectContaining({ slug: c.hero.slug }) as unknown,
        },
      ]);
    });

    it('hides links to drafts from users (BR-06)', async () => {
      const forUser = json<CardDetails>(await user.get(`/api/cards/${c.hero.slug}`).expect(200));
      const forAdmin = json<CardDetails>(await admin.get(`/api/cards/${c.hero.slug}`).expect(200));

      expect(forUser.links.map((l) => l.card.slug)).toEqual([c.temple.slug]);
      expect(forAdmin.links.map((l) => l.card.slug).sort()).toEqual(
        [c.temple.slug, c.draft.slug].sort(),
      );
    });

    it('answers 404 to a user for a draft, 200 to an admin (BR-06)', async () => {
      await user.get(`/api/cards/${c.draft.slug}`).expect(404);
      await admin.get(`/api/cards/${c.draft.slug}`).expect(200);
    });

    it('returns 404 for an unknown card', async () => {
      await user.get('/api/cards/no-such-card').expect(404);
    });
  });
});
