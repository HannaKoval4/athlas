import type { MapCulture, RegionGeometry } from '@atlas/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Raw row of the time-slice query (Postgres json values arrive already parsed). */
export interface ActiveRegionRow {
  id: string;
  slug: string;
  name: string;
  geojson: RegionGeometry;
  centerLat: number;
  centerLng: number;
  cultures: MapCulture[];
}

@Injectable()
export class MapRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Time slice of the map (BR-04, DM-03): regions occupied in `year` by a culture that has
   * at least one published card, each with the list of those cultures.
   *
   * - `active` keeps one row per (region, culture): a culture may have several overlapping
   *   CultureRegion periods in one region. The year filter can use the
   *   ("startYear", "endYear") index; the approximate-dating flag is OR-ed across periods.
   * - EXISTS stops at the first published card instead of counting all of them.
   * - json_agg builds the nested `cultures` array in the database, so one query
   *   returns the whole slice (no extra query per region).
   */
  findActiveRegions(year: number): Promise<ActiveRegionRow[]> {
    return this.prisma.$queryRaw<ActiveRegionRow[]>`
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
      SELECT r.id,
             r.slug,
             r.name,
             r.geojson,
             r."centerLat",
             r."centerLng",
             json_agg(
               json_build_object(
                 'id', c.id,
                 'slug', c.slug,
                 'name', c.name,
                 'color', c.color,
                 'dateApproximate', a."dateApproximate"
               ) ORDER BY c.name
             ) AS cultures
      FROM active a
      JOIN "Region" r ON r.id = a."regionId"
      JOIN "Culture" c ON c.id = a."cultureId"
      GROUP BY r.id
      ORDER BY r.name`;
  }
}
