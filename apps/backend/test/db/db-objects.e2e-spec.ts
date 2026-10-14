import type { PrismaClient } from '../../src/generated/prisma/client';
import { HolidayDateType } from '../../src/generated/prisma/enums';
import {
  createCard,
  createCulture,
  createEra,
  createHoliday,
  createRegion,
  createUser,
  placeCulture,
} from '../factories';
import { createTestPrisma, truncateAll } from '../utils/db';

interface RegionRow {
  id: string;
  slug: string;
  name: string;
  geojson: unknown;
  centerLat: number;
  centerLng: number;
  cultures: { id: string; slug: string; name: string; color: string; dateApproximate: boolean }[];
}

interface BestRow {
  userId: string;
  quizId: string;
  bestScore: number;
  total: number;
  passed: boolean;
  attempts: number;
}

/**
 * Integration tests of the triggers, functions, procedure and view from migration
 * 20261013132052_db_objects. Like the constraints, they hold even if application code is bypassed.
 */
describe('Database objects (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('trigger card_published_at_trg (DM-09)', () => {
    it('DB-01: sets publishedAt when a card is inserted as published', async () => {
      const culture = await createCulture(prisma);
      const before = Date.now();

      const card = await createCard(prisma, culture.id, { published: true });

      expect(card.publishedAt).toBeInstanceOf(Date);
      // The column is UTC without a zone; allow for clock skew between the app and Docker.
      expect(Math.abs((card.publishedAt?.getTime() ?? 0) - before)).toBeLessThan(60_000);
    });

    it('DB-02: keeps an explicit publishedAt on publish', async () => {
      const culture = await createCulture(prisma);
      const draft = await createCard(prisma, culture.id, { published: false });
      const date = new Date('2026-01-15T10:00:00.000Z');

      const card = await prisma.card.update({
        where: { id: draft.id },
        data: { published: true, publishedAt: date },
      });

      expect(card.publishedAt).toEqual(date);
    });

    it('DB-03: clears publishedAt when a card is unpublished', async () => {
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id, { published: true });

      const draft = await prisma.card.update({
        where: { id: card.id },
        data: { published: false },
      });

      expect(draft.publishedAt).toBeNull();
    });

    it('leaves a draft without publishedAt even if one is given', async () => {
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id, { published: false });

      const draft = await prisma.card.update({
        where: { id: card.id },
        data: { publishedAt: new Date('2026-01-15T10:00:00.000Z') },
      });

      expect(draft.publishedAt).toBeNull();
    });
  });

  describe('trigger note_sync_culture_trg (DM-07)', () => {
    it('DB-04: fills cultureId of a note on a card', async () => {
      const user = await createUser(prisma);
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);

      const note = await prisma.note.create({
        data: { userId: user.id, content: 'Text', cardId: card.id },
      });

      expect(note.cultureId).toBe(culture.id);
    });

    it('overrides a cultureId that does not match the card', async () => {
      const user = await createUser(prisma);
      const culture = await createCulture(prisma);
      const other = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);

      const note = await prisma.note.create({
        data: { userId: user.id, content: 'Text', cardId: card.id, cultureId: other.id },
      });

      expect(note.cultureId).toBe(culture.id);
    });

    it('DB-05: updates cultureId when the note moves to a card of another culture', async () => {
      const user = await createUser(prisma);
      const greece = await createCulture(prisma);
      const egypt = await createCulture(prisma);
      const first = await createCard(prisma, greece.id);
      const second = await createCard(prisma, egypt.id);
      const note = await prisma.note.create({
        data: { userId: user.id, content: 'Text', cardId: first.id },
      });

      const moved = await prisma.note.update({
        where: { id: note.id },
        data: { cardId: second.id },
      });

      expect(moved.cultureId).toBe(egypt.id);
    });

    it('DB-06: keeps the culture when the card is deleted', async () => {
      const user = await createUser(prisma);
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);
      const note = await prisma.note.create({
        data: { userId: user.id, content: 'Text', cardId: card.id },
      });

      await prisma.card.delete({ where: { id: card.id } });

      const orphan = await prisma.note.findUniqueOrThrow({ where: { id: note.id } });
      expect(orphan).toMatchObject({ cardId: null, cultureId: culture.id });
    });
  });

  describe('function active_regions_at (BR-04, DM-03)', () => {
    /** The time-slice query as it was in MapRepository before the function (reference). */
    function legacySlice(year: number): Promise<RegionRow[]> {
      return prisma.$queryRaw<RegionRow[]>`
        WITH active AS (
          SELECT cr."regionId",
                 cr."cultureId",
                 bool_or(cr."dateApproximate") AS "dateApproximate"
          FROM "CultureRegion" cr
          WHERE cr."startYear" <= ${year}
            AND cr."endYear" >= ${year}
            AND EXISTS (
              SELECT 1 FROM "Card" card
              WHERE card."cultureId" = cr."cultureId" AND card.published
            )
          GROUP BY cr."regionId", cr."cultureId"
        )
        SELECT r.id, r.slug, r.name, r.geojson, r."centerLat", r."centerLng",
               json_agg(
                 json_build_object(
                   'id', c.id, 'slug', c.slug, 'name', c.name, 'color', c.color,
                   'dateApproximate', a."dateApproximate"
                 ) ORDER BY c.name
               ) AS cultures
        FROM active a
        JOIN "Region" r ON r.id = a."regionId"
        JOIN "Culture" c ON c.id = a."cultureId"
        GROUP BY r.id
        ORDER BY r.name`;
    }

    const slice = (year: number) =>
      prisma.$queryRaw<RegionRow[]>`SELECT * FROM active_regions_at(${year}::int)`;

    async function seedMap() {
      const greece = await createCulture(prisma, {
        name: 'Греция',
        startYear: -800,
        endYear: -146,
      });
      const egypt = await createCulture(prisma, { name: 'Египет', startYear: -3100, endYear: -30 });
      const ghost = await createCulture(prisma, { name: 'Пустая', startYear: -800, endYear: -100 });
      await createCard(prisma, greece.id);
      await createCard(prisma, egypt.id);
      await createCard(prisma, ghost.id, { published: false });
      const mainland = await createRegion(prisma, { name: 'Mainland' });
      const delta = await createRegion(prisma, { name: 'Delta' });
      const hidden = await createRegion(prisma, { name: 'Hidden' });
      await placeCulture(prisma, greece.id, mainland.id, { startYear: -800, endYear: -146 });
      await placeCulture(prisma, egypt.id, delta.id, { startYear: -3100, endYear: -30 });
      // Two overlapping periods of one culture in one region: one row, approximate OR-ed.
      await placeCulture(prisma, egypt.id, mainland.id, {
        startYear: -332,
        endYear: -200,
        dateApproximate: true,
      });
      await placeCulture(prisma, egypt.id, mainland.id, { startYear: -250, endYear: -30 });
      await placeCulture(prisma, ghost.id, hidden.id, { startYear: -800, endYear: -100 });
    }

    it.each([-3100, -800, -332, -250, -146, -145, -30, -29, 1500])(
      'DB-07: returns the same rows as the legacy query in year %i',
      async (year) => {
        await seedMap();

        expect(await slice(year)).toEqual(await legacySlice(year));
      },
    );

    it('DB-07: includes both ends of a period and excludes the year after it', async () => {
      await seedMap();

      const names = async (year: number) => (await slice(year)).map((row) => row.name);

      expect(await names(-3100)).toEqual(['Delta']);
      expect(await names(-30)).toEqual(['Delta', 'Mainland']);
      expect(await names(-29)).toEqual([]);
      const mainland = (await slice(-250)).find((row) => row.name === 'Mainland');
      expect(mainland?.cultures.map((c) => [c.name, c.dateApproximate])).toEqual([
        ['Греция', false],
        ['Египет', true],
      ]);
    });

    it('DB-08: hides a culture that has no published cards', async () => {
      await seedMap();

      const rows = await slice(-500);

      expect(rows.map((row) => row.name)).not.toContain('Hidden');
      expect(rows.flatMap((row) => row.cultures.map((c) => c.name))).not.toContain('Пустая');
    });
  });

  describe('function next_dated_day (BR-15)', () => {
    const nextDay = (month: number, day: number, includeDrafts: boolean) =>
      prisma.$queryRaw<{ month: number; day: number }[]>`
        SELECT month, day FROM next_dated_day(${month}::int, ${day}::int, ${includeDrafts})`;

    it('DB-09: skips drafts for users and counts them for admins', async () => {
      const culture = await createCulture(prisma);
      await createHoliday(prisma, culture.id, {
        name: 'Праздник',
        description: 'D',
        dateType: HolidayDateType.EXACT,
        month: 11,
        day: 4,
      });
      await createCard(prisma, culture.id, { month: 9, day: 20 });
      await createCard(prisma, culture.id, { month: 10, day: 1, published: false });
      // A movable holiday has no day and never counts.
      await createHoliday(prisma, culture.id, { name: 'Подвижный', description: 'D' });

      expect(await nextDay(9, 20, false)).toEqual([{ month: 9, day: 20 }]);
      expect(await nextDay(9, 21, false)).toEqual([{ month: 11, day: 4 }]);
      expect(await nextDay(9, 21, true)).toEqual([{ month: 10, day: 1 }]);
      // Wraps around the end of the year.
      expect(await nextDay(12, 31, false)).toEqual([{ month: 9, day: 20 }]);
    });

    it('DB-09: returns no row when nothing is dated', async () => {
      const culture = await createCulture(prisma);
      await createCard(prisma, culture.id, { month: 5, day: 1, published: false });

      expect(await nextDay(1, 1, false)).toEqual([]);
      expect(await nextDay(1, 1, true)).toEqual([{ month: 5, day: 1 }]);
    });
  });

  describe('procedure revoke_user_sessions (BR-03)', () => {
    it('DB-10: revokes only the active tokens of the given user', async () => {
      const user = await createUser(prisma);
      const other = await createUser(prisma);
      const expiresAt = new Date(Date.now() + 86_400_000);
      const revokedEarlier = new Date('2026-01-01T00:00:00.000Z');
      await prisma.refreshToken.createMany({
        data: [
          { id: 'active-1', userId: user.id, tokenHash: 'a', expiresAt },
          { id: 'active-2', userId: user.id, tokenHash: 'b', expiresAt },
          { id: 'old', userId: user.id, tokenHash: 'c', expiresAt, revokedAt: revokedEarlier },
          { id: 'foreign', userId: other.id, tokenHash: 'd', expiresAt },
        ],
      });

      await prisma.$executeRaw`CALL revoke_user_sessions(${user.id})`;

      const tokens = new Map(
        (await prisma.refreshToken.findMany()).map((token) => [token.id, token.revokedAt]),
      );
      expect(tokens.get('active-1')).toBeInstanceOf(Date);
      expect(tokens.get('active-2')).toBeInstanceOf(Date);
      // An already revoked token keeps its original revocation time.
      expect(tokens.get('old')).toEqual(revokedEarlier);
      expect(tokens.get('foreign')).toBeNull();
    });
  });

  describe('view quiz_best_result (BR-12)', () => {
    it('DB-11: keeps the best finished attempt and counts finished attempts', async () => {
      const user = await createUser(prisma);
      const other = await createUser(prisma);
      const culture = await createCulture(prisma);
      const era = await createEra(prisma, { startYear: -800, endYear: -1 });
      const quiz = await prisma.quiz.create({
        data: { eraId: era.id, cultureId: culture.id, title: 'Quiz' },
      });
      const attempt = (
        userId: string,
        score: number | null,
        finishedAt: Date | null,
      ): Promise<unknown> =>
        prisma.quizAttempt.create({
          data: {
            userId,
            quizId: quiz.id,
            questionIds: [],
            total: 10,
            score,
            passed: score === null ? null : score >= 7,
            finishedAt,
          },
        });
      const day = (n: number) => new Date(Date.UTC(2026, 9, n));
      await attempt(user.id, 6, day(1));
      await attempt(user.id, 9, day(2));
      await attempt(user.id, 9, day(3));
      await attempt(user.id, null, null); // started, not finished
      await attempt(other.id, 3, day(1));

      const rows = await prisma.$queryRaw<BestRow[]>`
        SELECT * FROM quiz_best_result ORDER BY "bestScore" DESC`;

      expect(rows).toEqual([
        {
          userId: user.id,
          quizId: quiz.id,
          bestScore: 9,
          total: 10,
          passed: true,
          attempts: 3,
        },
        {
          userId: other.id,
          quizId: quiz.id,
          bestScore: 3,
          total: 10,
          passed: false,
          attempts: 1,
        },
      ]);
    });

    it('DB-11: has no row for a user with only an unfinished attempt', async () => {
      const user = await createUser(prisma);
      const culture = await createCulture(prisma);
      const era = await createEra(prisma, { startYear: -800, endYear: -1 });
      const quiz = await prisma.quiz.create({
        data: { eraId: era.id, cultureId: culture.id, title: 'Quiz' },
      });
      await prisma.quizAttempt.create({
        data: { userId: user.id, quizId: quiz.id, questionIds: [], total: 10 },
      });

      expect(await prisma.$queryRaw`SELECT * FROM quiz_best_result`).toEqual([]);
    });
  });
});
