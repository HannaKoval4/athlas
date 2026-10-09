import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Book } from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { Role } from '../../src/generated/prisma/enums';
import { createCard, createCulture } from '../factories';
import { createTestApp, json } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/**
 * A local stand-in for openlibrary.org: the tests never call the real service. It records the
 * requests and answers according to the search phrase.
 */
function startStub(): Promise<{ server: Server; url: string; requests: IncomingMessage[] }> {
  const requests: IncomingMessage[] = [];
  const server = createServer((req, res) => {
    requests.push(req);
    const q = new URL(req.url ?? '/', 'http://stub').searchParams.get('q');
    if (q === 'Broken') {
      res.writeHead(503).end();
      return;
    }
    const docs = Array.from({ length: 7 }, (_, i) => ({
      key: `/works/OL${i}W`,
      title: `${q} book ${i}`,
      author_name: ['Author'],
      first_publish_year: 2000 + i,
      ...(i === 0 && { cover_i: 42 }),
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ docs }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}`, requests });
    });
  });
}

describe('Books from Open Library (e2e, BR-16)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let stub: Awaited<ReturnType<typeof startStub>>;
  let reader: TestAgent;
  let admin: TestAgent;
  const ids: Record<string, string> = {};

  const books = async (agent: TestAgent, query: Record<string, string>) =>
    json<Book[]>(await agent.get('/api/books').query(query).expect(200));

  async function signIn(email: string, role: Role = Role.USER): Promise<TestAgent> {
    const agent = request.agent(app.getHttpServer());
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
    stub = await startStub();
    process.env.OPEN_LIBRARY_BASE_URL = stub.url;
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();

    const culture = await createCulture(prisma);
    await prisma.culture.update({
      where: { id: culture.id },
      data: { booksQuery: 'Ancient Greece' },
    });
    const withQuery = async (title: string, booksQuery: string | null, published = true) => {
      const card = await createCard(prisma, culture.id, { title, published });
      await prisma.card.update({ where: { id: card.id }, data: { booksQuery } });
      return card.id;
    };
    Object.assign(ids, {
      culture: culture.id,
      parthenon: await withQuery('Парфенон', 'Parthenon'),
      noQuery: await withQuery('Без запроса', null),
      broken: await withQuery('Сбой', 'Broken'),
      draft: await withQuery('Черновик', 'Secret', false),
    });

    reader = await signIn('reader@example.com');
    admin = await signIn('admin@example.com', Role.ADMIN);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await new Promise((resolve) => stub.server.close(resolve));
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get(`/api/books?cardId=${ids.parthenon}`).expect(401);
  });

  it('returns at most 5 books for the English phrase of a card', async () => {
    const result = await books(reader, { cardId: ids.parthenon ?? '' });

    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({
      key: '/works/OL0W',
      title: 'Parthenon book 0',
      authors: ['Author'],
      firstPublishYear: 2000,
      coverUrl: 'https://covers.openlibrary.org/b/id/42-M.jpg',
      url: 'https://openlibrary.org/works/OL0W',
    });
    const sent = stub.requests.at(-1);
    expect(sent?.headers['user-agent']).toMatch(/^HistoryAtlas\//);
  });

  it('answers the second request from the cache (7 days)', async () => {
    const before = stub.requests.length;

    await books(reader, { cultureId: ids.culture ?? '' });
    await books(reader, { cultureId: ids.culture ?? '' });

    expect(stub.requests.length).toBe(before + 1);
    const cached = await prisma.bookCache.findUnique({
      where: { queryKey: 'openlibrary:v1:ancient greece' },
    });
    expect(cached?.payload).toHaveLength(5);
  });

  it('asks again when the cached answer is older than 7 days', async () => {
    await prisma.bookCache.update({
      where: { queryKey: 'openlibrary:v1:ancient greece' },
      data: { fetchedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    });
    const before = stub.requests.length;

    await books(reader, { cultureId: ids.culture ?? '' });

    expect(stub.requests.length).toBe(before + 1);
  });

  it('returns an empty list when Open Library fails, and does not cache the failure', async () => {
    expect(await books(reader, { cardId: ids.broken ?? '' })).toEqual([]);
    expect(await prisma.bookCache.count({ where: { queryKey: 'openlibrary:v1:broken' } })).toBe(0);
  });

  it('returns an empty list without calling Open Library when there is no phrase', async () => {
    const before = stub.requests.length;

    expect(await books(reader, { cardId: ids.noQuery ?? '' })).toEqual([]);
    expect(stub.requests.length).toBe(before);
  });

  it('hides the books of a draft from users (BR-06)', async () => {
    await reader.get('/api/books').query({ cardId: ids.draft }).expect(404);
    expect(await books(admin, { cardId: ids.draft ?? '' })).toHaveLength(5);
  });

  it.each([
    ['neither id', {}, 400],
    ['both ids', { cardId: UNKNOWN_ID, cultureId: UNKNOWN_ID }, 400],
    ['an invalid id', { cardId: 'parthenon' }, 400],
    ['an unknown card', { cardId: UNKNOWN_ID }, 404],
    ['an unknown culture', { cultureId: UNKNOWN_ID }, 404],
  ])('%s: answers the expected status', async (_name, query, status) => {
    await reader.get('/api/books').query(query).expect(status);
  });
});
