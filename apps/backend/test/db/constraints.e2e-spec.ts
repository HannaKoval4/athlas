import type { PrismaClient } from '../../src/generated/prisma/client';
import { CardType, HolidayDateType, RelationType } from '../../src/generated/prisma/enums';
import { createCard, createCulture, createSource, createUser } from '../factories';
import { createTestPrisma, truncateAll } from '../utils/db';

/**
 * Integration tests of the database-level rules (CHECK, UNIQUE, FK actions) from the migration.
 * They guarantee data integrity even if application code has a bug.
 */
describe('Database constraints (e2e)', () => {
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

  /** Asserts that the query fails because of the named constraint. */
  async function expectViolation(query: Promise<unknown>, constraint: string): Promise<void> {
    await expect(query).rejects.toThrow(constraint);
  }

  describe('periods (DM-01, DM-02)', () => {
    it('rejects an era with startYear > endYear', async () => {
      await expectViolation(
        prisma.era.create({ data: { slug: 'bad', name: 'Bad', startYear: 100, endYear: -100 } }),
        'era_period_chk',
      );
    });

    it('rejects a culture that starts in year 0', async () => {
      await expectViolation(
        prisma.culture.create({
          data: {
            slug: 'zero',
            name: 'Z',
            description: 'D',
            startYear: 0,
            endYear: 10,
            color: '#000000',
          },
        }),
        'culture_period_chk',
      );
    });

    it('rejects a card that ends in year 0', async () => {
      const culture = await createCulture(prisma);

      await expectViolation(
        createCard(prisma, culture.id, { startYear: -10, endYear: 0 }),
        'card_period_chk',
      );
    });

    it('accepts a card spanning the -1/1 boundary', async () => {
      const culture = await createCulture(prisma);

      await expect(
        createCard(prisma, culture.id, { startYear: -1, endYear: 1 }),
      ).resolves.toMatchObject({
        startYear: -1,
        endYear: 1,
      });
    });

    it('accepts a single-year period (startYear = endYear)', async () => {
      const culture = await createCulture(prisma);

      await expect(
        createCard(prisma, culture.id, { startYear: -490, endYear: -490 }),
      ).resolves.toBeDefined();
    });

    it('rejects a culture-region period with startYear > endYear', async () => {
      const culture = await createCulture(prisma);
      const region = await prisma.region.create({
        data: { slug: 'r', name: 'R', geojson: {}, centerLat: 0, centerLng: 0 },
      });

      await expectViolation(
        prisma.cultureRegion.create({
          data: { cultureId: culture.id, regionId: region.id, startYear: -100, endYear: -200 },
        }),
        'cr_period_chk',
      );
    });
  });

  describe('card calendar day', () => {
    it('rejects month without day', async () => {
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);

      await expectViolation(
        prisma.card.update({ where: { id: card.id }, data: { month: 5 } }),
        'card_date_chk',
      );
    });

    it('rejects month 13', async () => {
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);

      await expectViolation(
        prisma.card.update({ where: { id: card.id }, data: { month: 13, day: 1 } }),
        'card_date_chk',
      );
    });

    it('accepts a valid month and day', async () => {
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);

      await expect(
        prisma.card.update({ where: { id: card.id }, data: { month: 9, day: 12 } }),
      ).resolves.toMatchObject({ month: 9, day: 12 });
    });
  });

  describe('card links (DM-06)', () => {
    it('rejects a link from a card to itself', async () => {
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);

      await expectViolation(
        prisma.cardLink.create({
          data: { fromCardId: card.id, toCardId: card.id, relationType: RelationType.RELATED },
        }),
        'cardlink_self_chk',
      );
    });

    it('rejects a duplicate link of the same type', async () => {
      const culture = await createCulture(prisma);
      const [a, b] = [await createCard(prisma, culture.id), await createCard(prisma, culture.id)];
      const link = { fromCardId: a.id, toCardId: b.id, relationType: RelationType.RELATED };
      await prisma.cardLink.create({ data: link });

      await expect(prisma.cardLink.create({ data: link })).rejects.toMatchObject({ code: 'P2002' });
    });

    it('allows the same pair with a different relation type', async () => {
      const culture = await createCulture(prisma);
      const [a, b] = [await createCard(prisma, culture.id), await createCard(prisma, culture.id)];
      await prisma.cardLink.create({
        data: { fromCardId: a.id, toCardId: b.id, relationType: RelationType.RELATED },
      });

      await expect(
        prisma.cardLink.create({
          data: { fromCardId: a.id, toCardId: b.id, relationType: RelationType.DEPICTS },
        }),
      ).resolves.toBeDefined();
    });

    it('deletes links together with the card (cascade)', async () => {
      const culture = await createCulture(prisma);
      const [a, b] = [await createCard(prisma, culture.id), await createCard(prisma, culture.id)];
      await prisma.cardLink.create({
        data: { fromCardId: a.id, toCardId: b.id, relationType: RelationType.RELATED },
      });

      await prisma.card.delete({ where: { id: b.id } });

      expect(await prisma.cardLink.count()).toBe(0);
    });
  });

  describe('notes (DM-07)', () => {
    it('rejects a note attached to neither a card nor a culture', async () => {
      const user = await createUser(prisma);

      await expectViolation(
        prisma.note.create({ data: { userId: user.id, content: 'Text' } }),
        'note_target_chk',
      );
    });

    it('accepts a note attached only to a culture', async () => {
      const user = await createUser(prisma);
      const culture = await createCulture(prisma);

      await expect(
        prisma.note.create({ data: { userId: user.id, content: 'Text', cultureId: culture.id } }),
      ).resolves.toBeDefined();
    });
  });

  describe('holidays (DM-05)', () => {
    it('rejects an EXACT holiday without a date', async () => {
      const culture = await createCulture(prisma);

      await expectViolation(
        prisma.holiday.create({
          data: {
            slug: 'h',
            cultureId: culture.id,
            name: 'H',
            description: 'D',
            dateType: HolidayDateType.EXACT,
          },
        }),
        'holiday_exact_chk',
      );
    });

    it('rejects a SEASON holiday without a season', async () => {
      const culture = await createCulture(prisma);

      await expectViolation(
        prisma.holiday.create({
          data: {
            slug: 'h',
            cultureId: culture.id,
            name: 'H',
            description: 'D',
            dateType: HolidayDateType.SEASON,
          },
        }),
        'holiday_season_chk',
      );
    });

    it('accepts a MOVABLE holiday without a date', async () => {
      const culture = await createCulture(prisma);

      await expect(
        prisma.holiday.create({
          data: {
            slug: 'h',
            cultureId: culture.id,
            name: 'H',
            description: 'D',
            dateType: HolidayDateType.MOVABLE,
            dateNote: 'Lunar calendar',
          },
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('users (BR-01)', () => {
    it('rejects an e-mail that is not lower-case', async () => {
      await expectViolation(
        prisma.user.create({ data: { email: 'User@Test.Local', name: 'U', passwordHash: 'h' } }),
        'user_email_lower_chk',
      );
    });

    it('rejects a duplicate e-mail', async () => {
      await prisma.user.create({
        data: { email: 'user@test.local', name: 'U', passwordHash: 'h' },
      });

      await expect(
        prisma.user.create({ data: { email: 'user@test.local', name: 'U2', passwordHash: 'h' } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('quizzes', () => {
    it.each([0, 101])('rejects passPercent %i', async (passPercent) => {
      const culture = await createCulture(prisma);
      const era = await prisma.era.create({
        data: { slug: 'e', name: 'E', startYear: -1000, endYear: -1 },
      });

      await expectViolation(
        prisma.quiz.create({
          data: { eraId: era.id, cultureId: culture.id, title: 'Q', passPercent },
        }),
        'quiz_pass_chk',
      );
    });
  });

  describe('referential actions (BR-17)', () => {
    it('does not allow deleting a culture that has cards (Restrict)', async () => {
      const culture = await createCulture(prisma);
      await createCard(prisma, culture.id, { type: CardType.EVENT });

      await expect(prisma.culture.delete({ where: { id: culture.id } })).rejects.toThrow();
      expect(await prisma.culture.count()).toBe(1);
    });

    it('does not allow deleting a source cited by a card (Restrict)', async () => {
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);
      const source = await createSource(prisma);
      await prisma.cardSource.create({ data: { cardId: card.id, sourceId: source.id } });

      await expect(prisma.source.delete({ where: { id: source.id } })).rejects.toThrow();
    });

    it('keeps a note when its card is deleted (SetNull) if the culture link remains', async () => {
      const user = await createUser(prisma);
      const culture = await createCulture(prisma);
      const card = await createCard(prisma, culture.id);
      const note = await prisma.note.create({
        data: { userId: user.id, content: 'Text', cardId: card.id, cultureId: culture.id },
      });

      await prisma.card.delete({ where: { id: card.id } });

      expect(await prisma.note.findUnique({ where: { id: note.id } })).toMatchObject({
        cardId: null,
        cultureId: culture.id,
      });
    });
  });
});
