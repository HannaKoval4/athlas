import type { Note } from '@atlas/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import type { App } from 'supertest/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { createCard, createCulture } from '../factories';
import { createTestApp, json } from '../utils/app';
import { createTestPrisma, truncateAll } from '../utils/db';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Notes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let alice: TestAgent;
  let bob: TestAgent;
  let cultureId = '';
  let otherCultureId = '';
  let cardId = '';
  let draftId = '';

  const server = () => app.getHttpServer();

  async function signUp(email: string): Promise<TestAgent> {
    const agent = request.agent(server());
    await agent
      .post('/api/auth/register')
      .send({ email, password: 'Secret123', name: 'Reader', consent: true })
      .expect(201);
    return agent;
  }

  async function createNote(agent: TestAgent, body: object): Promise<Note> {
    return json<Note>(await agent.post('/api/notes').send(body).expect(201));
  }

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
    app = await createTestApp();

    const culture = await createCulture(prisma);
    cultureId = culture.id;
    otherCultureId = (await createCulture(prisma)).id;
    cardId = (await createCard(prisma, cultureId, { title: 'Парфенон' })).id;
    draftId = (await createCard(prisma, cultureId, { published: false })).id;

    alice = await signUp('alice@example.com');
    bob = await signUp('bob@example.com');
  });

  beforeEach(async () => {
    await prisma.note.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('requires authentication', async () => {
    await request(server()).get('/api/notes').expect(401);
    await request(server()).get('/api/notes/export?format=md').expect(401);
  });

  describe('POST /api/notes', () => {
    it('creates a card note and attaches the card culture', async () => {
      const note = await createNote(alice, {
        cardId,
        title: '  Ордер  ',
        content: '  Дорический ордер  ',
      });

      expect(note).toMatchObject({
        title: 'Ордер',
        content: 'Дорический ордер',
        card: { id: cardId, title: 'Парфенон' },
        culture: { id: cultureId },
      });
    });

    it('creates a culture note; a blank title becomes null', async () => {
      const note = await createNote(alice, { cultureId, title: '   ', content: 'О культуре' });

      expect(note.title).toBeNull();
      expect(note.card).toBeNull();
      expect(note.culture?.id).toBe(cultureId);
    });

    it.each([
      ['no target', { content: 'Text' }],
      ['empty content', { cultureId, content: '   ' }],
      ['too long content', { cultureId, content: 'x'.repeat(10_001) }],
      ['too long title', { cultureId, content: 'Text', title: 'x'.repeat(201) }],
      ['invalid card id', { cardId: 'abc', content: 'Text' }],
      ['unknown field', { cultureId, content: 'Text', userId: UNKNOWN_ID }],
      ['card of another culture', { cardId, cultureId: otherCultureId, content: 'Text' }],
    ])('answers 400 for %s', async (_name, body) => {
      await alice.post('/api/notes').send(body).expect(400);
    });

    it.each([
      ['unknown card', () => ({ cardId: UNKNOWN_ID, content: 'Text' })],
      ['unknown culture', () => ({ cultureId: UNKNOWN_ID, content: 'Text' })],
      ['draft card (BR-06)', () => ({ cardId: draftId, content: 'Text' })],
    ])('answers 404 for %s', async (_name, body) => {
      await alice.post('/api/notes').send(body()).expect(404);
    });
  });

  describe('GET /api/notes', () => {
    it("lists only the user's notes, filtered by card or culture (BR-07)", async () => {
      const cardNote = await createNote(alice, { cardId, content: 'Card note' });
      const cultureNote = await createNote(alice, { cultureId, content: 'Culture note' });
      await createNote(bob, { cultureId, content: 'Bob note' });

      const all = json<Note[]>(await alice.get('/api/notes').expect(200));
      const byCard = json<Note[]>(await alice.get(`/api/notes?cardId=${cardId}`).expect(200));
      const byCulture = json<Note[]>(
        await alice.get(`/api/notes?cultureId=${cultureId}`).expect(200),
      );

      // Newest first.
      expect(all.map((n) => n.id)).toEqual([cultureNote.id, cardNote.id]);
      expect(byCard.map((n) => n.id)).toEqual([cardNote.id]);
      // The culture filter includes the notes on the culture's cards.
      expect(byCulture).toHaveLength(2);
    });

    it('answers 400 for an invalid filter', async () => {
      await alice.get('/api/notes?cultureId=greece').expect(400);
    });
  });

  describe('PATCH /api/notes/:id', () => {
    it('changes the text and removes the title with null', async () => {
      const note = await createNote(alice, { cultureId, title: 'Old', content: 'Old' });

      const updated = json<Note>(
        await alice
          .patch(`/api/notes/${note.id}`)
          .send({ title: null, content: 'New' })
          .expect(200),
      );

      expect(updated).toMatchObject({ id: note.id, title: null, content: 'New' });
    });

    it('does not move a note to another card or culture', async () => {
      const note = await createNote(alice, { cultureId, content: 'Text' });

      await alice.patch(`/api/notes/${note.id}`).send({ cultureId: otherCultureId }).expect(400);
    });

    it("answers 404 for somebody else's note and leaves it unchanged (BR-07)", async () => {
      const note = await createNote(alice, { cultureId, content: 'Private' });

      await bob.patch(`/api/notes/${note.id}`).send({ content: 'Hacked' }).expect(404);

      const stored = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
      expect(stored.content).toBe('Private');
    });

    it('answers 400 for a non-UUID id', async () => {
      await alice.patch('/api/notes/123').send({ content: 'X' }).expect(400);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('deletes own note', async () => {
      const note = await createNote(alice, { cultureId, content: 'Text' });

      await alice.delete(`/api/notes/${note.id}`).expect(204);
      await alice.delete(`/api/notes/${note.id}`).expect(404);
    });

    it("answers 404 for somebody else's note (BR-07)", async () => {
      const note = await createNote(alice, { cultureId, content: 'Text' });

      await bob.delete(`/api/notes/${note.id}`).expect(404);
      expect(await prisma.note.count()).toBe(1);
    });
  });

  describe('GET /api/notes/export', () => {
    it("downloads the user's notes as Markdown grouped culture -> card (BR-19)", async () => {
      await createNote(alice, { cardId, title: 'Ордер', content: 'Дорический ордер' });
      await createNote(bob, { cultureId, content: 'Bob secret' });

      const res = await alice.get('/api/notes/export?format=md').expect(200);

      expect(res.headers['content-type']).toBe('text/markdown; charset=utf-8');
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="atlas-notes-\d{4}-\d{2}-\d{2}\.md"$/,
      );
      expect(res.text).toContain('### Карточка: Парфенон');
      expect(res.text).toContain('Дорический ордер');
      expect(res.text).not.toContain('Bob secret');
    });

    it('downloads a PDF with an embedded Cyrillic font', async () => {
      await createNote(alice, { cardId, content: 'Кириллица' });

      const res = await alice
        .get('/api/notes/export?format=pdf')
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const pdf = res.body as Buffer;

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(pdf.toString('latin1')).toContain('DejaVuSans');
    });

    it('answers 400 for an unknown format', async () => {
      await alice.get('/api/notes/export?format=docx').expect(400);
      await alice.get('/api/notes/export').expect(400);
    });
  });
});
