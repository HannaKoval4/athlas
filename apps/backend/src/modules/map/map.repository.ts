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
   * at least one published card, each with the list of those cultures. The query lives in the
   * SQL function active_regions_at (migration 20261013132052_db_objects), commented there.
   */
  findActiveRegions(year: number): Promise<ActiveRegionRow[]> {
    return this.prisma.$queryRaw<ActiveRegionRow[]>`
      SELECT * FROM active_regions_at(${year}::int)`;
  }
}
