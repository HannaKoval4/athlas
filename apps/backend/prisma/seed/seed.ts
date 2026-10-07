import * as argon2 from 'argon2';
import type { Prisma, PrismaClient } from '../../src/generated/prisma/client';
import { Role } from '../../src/generated/prisma/enums';
import type { SeedData } from './types';

export interface SeedUser {
  email: string;
  password: string;
  name: string;
}

export interface SeedOptions {
  admin: SeedUser;
  demo?: SeedUser;
  /**
   * publishedAt of the first card; later cards are published one day apart,
   * so the "New" tab shows a meaningful order. Fixed dates keep the seed deterministic.
   */
  firstPublishedAt?: Date;
}

export interface SeedCounts {
  eras: number;
  regions: number;
  sources: number;
  cultures: number;
  cultureRegions: number;
  cards: number;
  cardSources: number;
  cardLinks: number;
  holidays: number;
  users: number;
}

const DEFAULT_FIRST_PUBLISHED_AT = new Date('2026-09-01T09:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const PARAGRAPH_SEPARATOR = '\n\n';

type Tx = Prisma.TransactionClient;

async function upsertUser(tx: Tx, user: SeedUser, role: Role): Promise<void> {
  const email = user.email.trim().toLowerCase(); // BR-01
  // Existing users keep their password: re-running the seed must not reset credentials.
  await tx.user.upsert({
    where: { email },
    update: { role },
    create: { email, name: user.name, role, passwordHash: await argon2.hash(user.password) },
  });
}

/**
 * Writes seed data idempotently: every entity is upserted by its natural key
 * (slug, email, composite id), so running the seed again creates no duplicates.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  data: SeedData,
  options: SeedOptions,
): Promise<SeedCounts> {
  const firstPublishedAt = options.firstPublishedAt ?? DEFAULT_FIRST_PUBLISHED_AT;

  await prisma.$transaction(
    async (tx) => {
      for (const era of data.eras) {
        const fields = {
          name: era.name,
          description: era.description ?? null,
          startYear: era.startYear,
          endYear: era.endYear,
          sortOrder: era.sortOrder,
        };
        await tx.era.upsert({
          where: { slug: era.slug },
          update: fields,
          create: { slug: era.slug, ...fields },
        });
      }

      const regionIds = new Map<string, string>();
      for (const region of data.regions) {
        const fields = {
          name: region.name,
          geojson: region.geometry,
          centerLat: region.centerLat,
          centerLng: region.centerLng,
        };
        const row = await tx.region.upsert({
          where: { slug: region.slug },
          update: fields,
          create: { slug: region.slug, ...fields },
        });
        regionIds.set(region.slug, row.id);
      }

      const sourceIds = new Map<string, string>();
      for (const source of data.sources) {
        const fields = {
          type: source.type,
          title: source.title,
          author: source.author ?? null,
          publisher: source.publisher ?? null,
          year: source.year ?? null,
          url: source.url ?? null,
        };
        const row = await tx.source.upsert({
          where: { slug: source.slug },
          update: fields,
          create: { slug: source.slug, ...fields },
        });
        sourceIds.set(source.slug, row.id);
      }

      let cardIndex = 0;
      const cardIds = new Map<string, string>();
      for (const culture of data.cultures) {
        const cultureFields = {
          name: culture.name,
          description: culture.description,
          startYear: culture.startYear,
          endYear: culture.endYear,
          dateApproximate: culture.dateApproximate ?? false,
          color: culture.color,
        };
        const { id: cultureId } = await tx.culture.upsert({
          where: { slug: culture.slug },
          update: cultureFields,
          create: { slug: culture.slug, ...cultureFields },
        });

        for (const cr of culture.regions) {
          const regionId = regionIds.get(cr.region)!;
          await tx.cultureRegion.upsert({
            where: {
              cultureId_regionId_startYear: { cultureId, regionId, startYear: cr.startYear },
            },
            update: { endYear: cr.endYear, dateApproximate: cr.dateApproximate ?? false },
            create: {
              cultureId,
              regionId,
              startYear: cr.startYear,
              endYear: cr.endYear,
              dateApproximate: cr.dateApproximate ?? false,
            },
          });
        }

        for (const card of culture.cards) {
          const fields = {
            type: card.type,
            title: card.title,
            summary: card.summary,
            content: card.content.join(PARAGRAPH_SEPARATOR),
            cultureId,
            startYear: card.startYear,
            endYear: card.endYear,
            month: card.month ?? null,
            day: card.day ?? null,
            dateApproximate: card.dateApproximate ?? false,
            imageUrl: card.image?.url ?? null,
            imageCredit: card.image?.credit ?? null,
            published: true,
            publishedAt: new Date(firstPublishedAt.getTime() + cardIndex * DAY_MS),
          };
          cardIndex++;
          const row = await tx.card.upsert({
            where: { slug: card.slug },
            update: fields,
            create: { slug: card.slug, ...fields },
          });
          cardIds.set(card.slug, row.id);

          for (const sourceSlug of card.sources) {
            const sourceId = sourceIds.get(sourceSlug)!;
            await tx.cardSource.upsert({
              where: { cardId_sourceId: { cardId: row.id, sourceId } },
              update: {},
              create: { cardId: row.id, sourceId },
            });
          }
        }

        for (const link of culture.links) {
          const fromCardId = cardIds.get(link.from)!;
          const toCardId = cardIds.get(link.to)!;
          await tx.cardLink.upsert({
            where: {
              fromCardId_toCardId_relationType: { fromCardId, toCardId, relationType: link.type },
            },
            update: {},
            create: { fromCardId, toCardId, relationType: link.type },
          });
        }

        for (const holiday of culture.holidays) {
          const fields = {
            cultureId,
            name: holiday.name,
            description: holiday.description,
            dateType: holiday.dateType,
            month: holiday.month ?? null,
            day: holiday.day ?? null,
            season: holiday.season ?? null,
            dateNote: holiday.dateNote ?? null,
            cardId: holiday.card ? cardIds.get(holiday.card)! : null,
            sourceId: holiday.source ? sourceIds.get(holiday.source)! : null,
          };
          await tx.holiday.upsert({
            where: { slug: holiday.slug },
            update: fields,
            create: { slug: holiday.slug, ...fields },
          });
        }
      }

      await upsertUser(tx, options.admin, Role.ADMIN);
      if (options.demo) await upsertUser(tx, options.demo, Role.USER);
    },
    { timeout: 60_000 },
  );

  const [
    eras,
    regions,
    sources,
    cultures,
    cultureRegions,
    cards,
    cardSources,
    cardLinks,
    holidays,
    users,
  ] = await Promise.all([
    prisma.era.count(),
    prisma.region.count(),
    prisma.source.count(),
    prisma.culture.count(),
    prisma.cultureRegion.count(),
    prisma.card.count(),
    prisma.cardSource.count(),
    prisma.cardLink.count(),
    prisma.holiday.count(),
    prisma.user.count(),
  ]);
  return {
    eras,
    regions,
    sources,
    cultures,
    cultureRegions,
    cards,
    cardSources,
    cardLinks,
    holidays,
    users,
  };
}
