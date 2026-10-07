import type { MapCulture, MapRegion, MapSlice, RegionGeometry } from '@atlas/shared';
import { ApiProperty } from '@nestjs/swagger';

export class MapCultureDto implements MapCulture {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ancient-greece' })
  slug: string;

  @ApiProperty({ example: 'Древняя Греция' })
  name: string;

  @ApiProperty({ example: '#2F6DB5' })
  color: string;

  @ApiProperty({ description: 'The presence in this region is dated approximately (DM-04)' })
  dateApproximate: boolean;
}

class LatLngDto {
  @ApiProperty({ example: 37.5 })
  lat: number;

  @ApiProperty({ example: 22.4 })
  lng: number;
}

export class MapRegionDto implements MapRegion {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'peloponnese' })
  slug: string;

  @ApiProperty({ example: 'Пелопоннес' })
  name: string;

  @ApiProperty({
    description: 'Simplified GeoJSON Polygon / MultiPolygon; borders are conventional (DM-10)',
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [21.1, 37.9],
          [23.2, 37.9],
          [22.5, 36.4],
          [21.1, 37.9],
        ],
      ],
    },
  })
  geometry: RegionGeometry;

  @ApiProperty({ type: LatLngDto })
  center: { lat: number; lng: number };

  @ApiProperty({ type: [MapCultureDto] })
  cultures: MapCultureDto[];
}

export class MapSliceDto implements MapSlice {
  @ApiProperty({ example: -450 })
  year: number;

  @ApiProperty({ type: [MapRegionDto] })
  regions: MapRegionDto[];
}
