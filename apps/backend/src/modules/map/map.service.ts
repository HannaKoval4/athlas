import { formatYear, isYearInPeriod } from '@atlas/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ErasService } from '../eras/eras.service';
import type { MapSliceDto } from './dto/map-slice.dto';
import { MapRepository } from './map.repository';

@Injectable()
export class MapService {
  constructor(
    private readonly repository: MapRepository,
    private readonly eras: ErasService,
  ) {}

  /** Regions to highlight for `year`; with an era, the year must lie inside it (BR-05). */
  async getSlice(year: number, eraSlug?: string): Promise<MapSliceDto> {
    if (eraSlug !== undefined) {
      const era = await this.eras.findBySlug(eraSlug);
      if (!isYearInPeriod(year, era.startYear, era.endYear)) {
        throw new BadRequestException(
          `Year ${formatYear(year, 'en')} is outside the era "${era.slug}" ` +
            `(${formatYear(era.startYear, 'en')} – ${formatYear(era.endYear, 'en')})`,
        );
      }
    }

    const rows = await this.repository.findActiveRegions(year);
    return {
      year,
      regions: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        geometry: row.geojson,
        center: { lat: row.centerLat, lng: row.centerLng },
        cultures: row.cultures,
      })),
    };
  }
}
