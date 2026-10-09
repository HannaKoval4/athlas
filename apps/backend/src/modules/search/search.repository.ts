import {
  type CardListItem,
  type CultureRef,
  HIGHLIGHT_END,
  HIGHLIGHT_START,
  type HolidaySearchHit,
  SEARCH_GROUP_LIMIT,
} from '@atlas/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import type { CardType } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { buildTsQuery } from './ts-query';

export interface SearchFilters {
  /** Sanitized words (see extractSearchWords); empty searches by filters only */
  words: string[];
  type?: CardType;
  cultureId?: string;
  regionId?: string;
  yearFrom?: number;
  yearTo?: number;
  includeDrafts: boolean;
}

export interface CardHitRow extends CardListItem {
  snippet: string | null;
}

export interface CultureHitRow extends CultureRef {
  startYear: number;
  endYear: number;
  dateApproximate: boolean;
  snippet: string | null;
}

/** ts_headline options: one short fragment, found words wrapped in private-use marks. */
const HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, MaxWords=24, MinWords=12, MaxFragments=1`;

const TRUE = Prisma.sql`TRUE`;

/**
 * Period overlap (DM-03) of `alias` with the [yearFrom, yearTo] filter; either bound may be
 * missing. `alias` is always a constant from this file, never user input.
 */
function overlapsYears(alias: string, filters: SearchFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filters.yearTo !== undefined) {
    conditions.push(Prisma.sql`${Prisma.raw(`${alias}."startYear"`)} <= ${filters.yearTo}`);
  }
  if (filters.yearFrom !== undefined) {
    conditions.push(Prisma.sql`${Prisma.raw(`${alias}."endYear"`)} >= ${filters.yearFrom}`);
  }
  return conditions.length > 0 ? Prisma.join(conditions, ' AND ') : TRUE;
}

/**
 * The culture lived in the region; with a year filter – during an overlapping period
 * (CultureRegion is the time-slice table of the map).
 */
function cultureInRegion(cultureIdColumn: string, filters: SearchFilters): Prisma.Sql {
  if (!filters.regionId) return TRUE;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "CultureRegion" cr
    WHERE cr."cultureId" = ${Prisma.raw(cultureIdColumn)}
      AND cr."regionId" = ${filters.regionId}
      AND ${overlapsYears('cr', filters)}
  )`;
}

@Injectable()
export class SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Card search (F-09): full text over the stored, GIN-indexed `search_vector`
   * (title A > summary B > content C, Russian stemming) plus the filters. With a text query
   * the cards are ordered by ts_rank, otherwise chronologically. Users see only published
   * cards (BR-06). Returns one page and the total count.
   */
  async findCards(
    filters: SearchFilters,
    page: { skip: number; take: number },
  ): Promise<{ items: CardHitRow[]; total: number }> {
    const query = filters.words.length === 0 ? null : Prisma.sql`(${buildTsQuery(filters.words)})`;
    const where = Prisma.join(
      [
        filters.includeDrafts ? TRUE : Prisma.sql`card.published`,
        query ? Prisma.sql`card.search_vector @@ ${query}` : TRUE,
        filters.type ? Prisma.sql`card.type = ${filters.type}::"CardType"` : TRUE,
        filters.cultureId ? Prisma.sql`card."cultureId" = ${filters.cultureId}` : TRUE,
        overlapsYears('card', filters),
        cultureInRegion('card."cultureId"', filters),
      ],
      ' AND ',
    );

    const [items, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<CardHitRow[]>`
        SELECT card.id, card.slug, card.type, card.title, card.summary,
               card."startYear", card."endYear", card."dateApproximate",
               card."imageUrl", card.published,
               json_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'color', c.color)
                 AS culture,
               ${
                 query
                   ? Prisma.sql`ts_headline('russian', card.summary || ' ' || card.content, ${query}, ${HEADLINE_OPTIONS})`
                   : Prisma.sql`NULL`
               } AS snippet
        FROM "Card" card
        JOIN "Culture" c ON c.id = card."cultureId"
        WHERE ${where}
        ORDER BY ${
          query
            ? Prisma.sql`ts_rank(card.search_vector, ${query}) DESC, card.title`
            : Prisma.sql`card."startYear", card.title`
        }
        LIMIT ${page.take} OFFSET ${page.skip}`,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total FROM "Card" card WHERE ${where}`,
    ]);
    return { items, total };
  }

  /**
   * Cultures matching the text: the vector is built on the fly (a handful of rows, no index
   * needed), with the name weighted above the description.
   */
  findCultures(filters: SearchFilters): Promise<CultureHitRow[]> {
    const query = Prisma.sql`(${buildTsQuery(filters.words)})`;
    const vector = Prisma.sql`setweight(to_tsvector('russian', c.name), 'A') || setweight(to_tsvector('russian', c.description), 'B')`;
    return this.prisma.$queryRaw<CultureHitRow[]>`
      SELECT c.id, c.slug, c.name, c.color, c."startYear", c."endYear", c."dateApproximate",
             ts_headline('russian', c.description, ${query}, ${HEADLINE_OPTIONS}) AS snippet
      FROM "Culture" c
      WHERE ${vector} @@ ${query}
        AND ${filters.cultureId ? Prisma.sql`c.id = ${filters.cultureId}` : TRUE}
        AND ${overlapsYears('c', filters)}
        AND ${cultureInRegion('c.id', filters)}
      ORDER BY ts_rank(${vector}, ${query}) DESC, c.name
      LIMIT ${SEARCH_GROUP_LIMIT}`;
  }

  /**
   * Holidays matching the text (name A, description B). Holidays have no period of their
   * own, so the year filter applies to their culture. The linked card is returned only if
   * the user may open it (BR-06).
   */
  findHolidays(filters: SearchFilters): Promise<HolidaySearchHit[]> {
    const query = Prisma.sql`(${buildTsQuery(filters.words)})`;
    const vector = Prisma.sql`setweight(to_tsvector('russian', h.name), 'A') || setweight(to_tsvector('russian', h.description), 'B')`;
    return this.prisma.$queryRaw<HolidaySearchHit[]>`
      SELECT h.id, h.slug, h.name, h."dateType", h.month, h.day, h.season,
             json_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'color', c.color)
               AS culture,
             card.slug AS "cardSlug",
             ts_headline('russian', h.description, ${query}, ${HEADLINE_OPTIONS}) AS snippet
      FROM "Holiday" h
      JOIN "Culture" c ON c.id = h."cultureId"
      LEFT JOIN "Card" card
        ON card.id = h."cardId" AND ${filters.includeDrafts ? TRUE : Prisma.sql`card.published`}
      WHERE ${vector} @@ ${query}
        AND ${filters.cultureId ? Prisma.sql`h."cultureId" = ${filters.cultureId}` : TRUE}
        AND ${overlapsYears('c', filters)}
        AND ${cultureInRegion('h."cultureId"', filters)}
      ORDER BY ts_rank(${vector}, ${query}) DESC, h.name
      LIMIT ${SEARCH_GROUP_LIMIT}`;
  }
}
