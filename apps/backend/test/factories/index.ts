import type { PrismaClient } from '../../src/generated/prisma/client';
import { CardType, SourceType } from '../../src/generated/prisma/enums';

let sequence = 0;
/** Unique, readable suffix so factories can be called repeatedly within one test file. */
function next(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export async function createCulture(
  prisma: PrismaClient,
  overrides: { startYear?: number; endYear?: number } = {},
) {
  const slug = next('culture');
  return prisma.culture.create({
    data: {
      slug,
      name: `Culture ${slug}`,
      description: 'Test culture',
      startYear: overrides.startYear ?? -1000,
      endYear: overrides.endYear ?? -100,
      color: '#123456',
    },
  });
}

export async function createCard(
  prisma: PrismaClient,
  cultureId: string,
  overrides: Partial<{
    title: string;
    summary: string;
    content: string;
    type: CardType;
    startYear: number;
    endYear: number;
    published: boolean;
  }> = {},
) {
  const slug = next('card');
  return prisma.card.create({
    data: {
      slug,
      type: overrides.type ?? CardType.FACT,
      title: overrides.title ?? `Card ${slug}`,
      summary: overrides.summary ?? 'Summary',
      content: overrides.content ?? 'Content',
      cultureId,
      startYear: overrides.startYear ?? -500,
      endYear: overrides.endYear ?? -400,
      published: overrides.published ?? true,
    },
  });
}

export async function createSource(prisma: PrismaClient) {
  const slug = next('source');
  return prisma.source.create({ data: { slug, type: SourceType.BOOK, title: `Source ${slug}` } });
}

export async function createUser(prisma: PrismaClient) {
  const id = next('user');
  return prisma.user.create({
    data: { email: `${id}@test.local`, name: id, passwordHash: 'hash' },
  });
}

export async function createEra(
  prisma: PrismaClient,
  data: { startYear: number; endYear: number; sortOrder?: number; slug?: string },
) {
  const slug = data.slug ?? next('era');
  return prisma.era.create({
    data: {
      slug,
      name: `Era ${slug}`,
      startYear: data.startYear,
      endYear: data.endYear,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

/** A small square polygon; regions in tests only need valid GeoJSON. */
export async function createRegion(prisma: PrismaClient, overrides: { name?: string } = {}) {
  const slug = next('region');
  return prisma.region.create({
    data: {
      slug,
      name: overrides.name ?? `Region ${slug}`,
      geojson: {
        type: 'Polygon',
        coordinates: [
          [
            [20, 35],
            [21, 35],
            [21, 36],
            [20, 36],
            [20, 35],
          ],
        ],
      },
      centerLat: 35.5,
      centerLng: 20.5,
    },
  });
}

export async function placeCulture(
  prisma: PrismaClient,
  cultureId: string,
  regionId: string,
  period: { startYear: number; endYear: number; dateApproximate?: boolean },
) {
  return prisma.cultureRegion.create({
    data: {
      cultureId,
      regionId,
      startYear: period.startYear,
      endYear: period.endYear,
      dateApproximate: period.dateApproximate ?? false,
    },
  });
}
