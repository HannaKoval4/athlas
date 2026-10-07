import type { PrismaClient } from '../../src/generated/prisma/client';
import { createCard, createCulture } from '../factories';
import { createTestPrisma, truncateAll } from '../utils/db';

interface SearchRow {
  slug: string;
  rank: number;
}

/**
 * Full-text search over the generated `search_vector` column.
 * The production search query (module 6) will follow the same pattern.
 */
function search(prisma: PrismaClient, query: string): Promise<SearchRow[]> {
  return prisma.$queryRaw<SearchRow[]>`
    SELECT slug, ts_rank(search_vector, plainto_tsquery('russian', ${query}))::float AS rank
    FROM "Card"
    WHERE search_vector @@ plainto_tsquery('russian', ${query})
    ORDER BY rank DESC, slug`;
}

describe('Card full-text search (e2e)', () => {
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

  it('fills search_vector automatically on insert', async () => {
    const culture = await createCulture(prisma);
    await createCard(prisma, culture.id, { title: 'Великая пирамида' });

    const [row] = await prisma.$queryRaw<{ filled: boolean }[]>`
      SELECT search_vector IS NOT NULL AS filled FROM "Card"`;

    expect(row.filled).toBe(true);
  });

  it('finds a card by another word form (Russian stemming)', async () => {
    const culture = await createCulture(prisma);
    const card = await createCard(prisma, culture.id, { title: 'Пирамиды Египта' });

    const rows = await search(prisma, 'пирамида');

    expect(rows.map((r) => r.slug)).toEqual([card.slug]);
  });

  it('ranks a title match above a content-only match', async () => {
    const culture = await createCulture(prisma);
    const inContent = await createCard(prisma, culture.id, {
      title: 'Строительство в Гизе',
      content: 'Рядом находится сфинкс.',
    });
    const inTitle = await createCard(prisma, culture.id, { title: 'Большой сфинкс' });

    const rows = await search(prisma, 'сфинкс');

    expect(rows.map((r) => r.slug)).toEqual([inTitle.slug, inContent.slug]);
  });

  it('updates search_vector when the card text changes', async () => {
    const culture = await createCulture(prisma);
    const card = await createCard(prisma, culture.id, { title: 'Розеттский камень' });

    await prisma.card.update({ where: { id: card.id }, data: { title: 'Бюст Нефертити' } });

    expect(await search(prisma, 'камень')).toEqual([]);
    expect((await search(prisma, 'Нефертити')).map((r) => r.slug)).toEqual([card.slug]);
  });

  it('returns nothing for a word that is not present', async () => {
    const culture = await createCulture(prisma);
    await createCard(prisma, culture.id, { title: 'Парфенон' });

    expect(await search(prisma, 'Колизей')).toEqual([]);
  });
});
