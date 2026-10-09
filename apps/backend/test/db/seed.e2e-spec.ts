import * as argon2 from 'argon2';
import { loadSeedData } from '../../prisma/seed/load';
import { type SeedOptions, seedDatabase } from '../../prisma/seed/seed';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { Role } from '../../src/generated/prisma/enums';
import { createTestPrisma, truncateAll } from '../utils/db';

const OPTIONS: SeedOptions = {
  admin: { email: 'Admin@Atlas.Test', password: 'Admin12345', name: 'Admin' },
  demo: { email: 'demo@atlas.test', password: 'Demo12345', name: 'Demo' },
};

describe('Seed (e2e)', () => {
  let prisma: PrismaClient;
  const data = loadSeedData();
  const allCards = data.cultures.flatMap((c) => c.cards);
  const allQuizzes = data.quizzes.flatMap((file) => file.quizzes);

  beforeAll(async () => {
    prisma = createTestPrisma();
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('writes all seed entities', async () => {
    const counts = await seedDatabase(prisma, data, OPTIONS);

    expect(counts).toEqual({
      eras: data.eras.length,
      regions: data.regions.length,
      sources: data.sources.length,
      cultures: data.cultures.length,
      cultureRegions: data.cultures.reduce((n, c) => n + c.regions.length, 0),
      cards: allCards.length,
      cardSources: allCards.reduce((n, c) => n + c.sources.length, 0),
      cardLinks: data.cultures.reduce((n, c) => n + c.links.length, 0),
      holidays: data.cultures.reduce((n, c) => n + c.holidays.length, 0),
      quizzes: allQuizzes.length,
      questions: allQuizzes.reduce((n, q) => n + q.questions.length, 0),
      users: 2,
    });
  });

  it('is idempotent: a second run creates no duplicates', async () => {
    const before = await seedDatabase(prisma, data, OPTIONS);
    const after = await seedDatabase(prisma, data, OPTIONS);

    expect(after).toEqual(before);
  });

  it('creates the admin with a lower-cased e-mail, ADMIN role and an argon2 hash', async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@atlas.test' } });

    expect(admin.role).toBe(Role.ADMIN);
    expect(admin.passwordHash).not.toBe(OPTIONS.admin.password);
    await expect(argon2.verify(admin.passwordHash, OPTIONS.admin.password)).resolves.toBe(true);
  });

  it('does not reset an existing password on re-run', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { email: 'demo@atlas.test' } });

    await seedDatabase(prisma, data, OPTIONS);

    const after = await prisma.user.findUniqueOrThrow({ where: { email: 'demo@atlas.test' } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it('publishes every card on a distinct date (DM-09, "New" tab)', async () => {
    const cards = await prisma.card.findMany({ select: { published: true, publishedAt: true } });

    expect(cards.every((c) => c.published && c.publishedAt)).toBe(true);
    expect(new Set(cards.map((c) => c.publishedAt!.getTime())).size).toBe(cards.length);
  });

  it('keeps question and option ids on re-run, so past attempts stay reviewable', async () => {
    const ids = async () =>
      (await prisma.answerOption.findMany({ select: { id: true }, orderBy: { id: 'asc' } })).map(
        (option) => option.id,
      );
    const before = await ids();

    await seedDatabase(prisma, data, OPTIONS);

    expect(await ids()).toEqual(before);
  });

  it('marks questions with several correct options as multiple-choice (BR-10)', async () => {
    const questions = await prisma.question.findMany({
      select: { multiple: true, options: { select: { isCorrect: true } } },
    });

    for (const question of questions) {
      const correct = question.options.filter((option) => option.isCorrect).length;
      expect(question.multiple).toBe(correct > 1);
    }
  });

  it('gives every card at least one source', async () => {
    const withoutSources = await prisma.card.count({ where: { sources: { none: {} } } });

    expect(withoutSources).toBe(0);
  });

  it('makes the seeded cards searchable', async () => {
    const rows = await prisma.$queryRaw<{ slug: string }[]>`
      SELECT slug FROM "Card" WHERE search_vector @@ plainto_tsquery('russian', 'пирамида')`;

    expect(rows.map((r) => r.slug)).toContain('great-pyramid');
  });
});
