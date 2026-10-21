import {
  type AdminCultureRegion,
  type AdminCulture,
  type AdminEra,
  type AdminHoliday,
  type AdminRegion,
  type CultureInput,
  type CultureRegionInput,
  type EraInput,
  HEX_COLOR_PATTERN,
  type HolidayInput,
  type RegionGeometry,
  type RegionInput,
} from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { HolidayDateType, Season } from '../../../generated/prisma/enums';
import { CultureRefDto } from '../../cards/dto/card.dto';
import { RegionRefDto } from '../../search/dto/search.dto';
import { AdminCardRefDto } from './cards.dto';
import {
  BooleanField,
  IntField,
  LONG_TEXT_MAX,
  NullableIntField,
  NullableTextField,
  NullableUuidField,
  SlugField,
  TextField,
  UuidField,
  YearField,
} from './admin-fields';

export class EraInputDto implements EraInput {
  @SlugField()
  slug: string;

  @TextField()
  name: string;

  @NullableTextField(LONG_TEXT_MAX)
  description: string | null = null;

  @YearField()
  startYear: number;

  @YearField()
  endYear: number;

  @IntField(0, 1000)
  sortOrder: number;
}

export class AdminEraDto extends EraInputDto implements AdminEra {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Quizzes of the era; an era with quizzes cannot be deleted' })
  quizCount: number;
}

export class CultureInputDto implements CultureInput {
  @SlugField()
  slug: string;

  @TextField()
  name: string;

  @TextField(LONG_TEXT_MAX)
  description: string;

  @YearField()
  startYear: number;

  @YearField()
  endYear: number;

  @BooleanField()
  dateApproximate: boolean;

  @ApiProperty({ example: '#1d4ed8', pattern: HEX_COLOR_PATTERN.source })
  @Matches(HEX_COLOR_PATTERN, { message: 'color must be a HEX colour like #1d4ed8' })
  color: string;

  @NullableTextField()
  booksQuery: string | null = null;
}

export class AdminCultureDto extends CultureInputDto implements AdminCulture {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Cards of the culture; a culture with cards cannot be deleted' })
  cardCount: number;
}

export class RegionInputDto implements RegionInput {
  @SlugField()
  slug: string;

  @TextField()
  name: string;

  @ApiProperty({
    description: 'Simplified GeoJSON Polygon or MultiPolygon, [lng, lat] points (DM-10)',
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [20, 35],
          [21, 35],
          [21, 36],
          [20, 35],
        ],
      ],
    },
  })
  @IsObject()
  geojson: RegionGeometry;

  @ApiProperty({ example: 37.97 })
  @IsLatitude()
  centerLat: number;

  @ApiProperty({ example: 23.72 })
  @IsLongitude()
  centerLng: number;
}

export class AdminRegionDto extends RegionInputDto implements AdminRegion {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Culture periods in the region; deleted together with it' })
  periodCount: number;
}

export class CultureRegionInputDto implements CultureRegionInput {
  @UuidField()
  cultureId: string;

  @UuidField()
  regionId: string;

  @YearField()
  startYear: number;

  @YearField()
  endYear: number;

  @BooleanField()
  dateApproximate: boolean;
}

export class CultureRegionsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  regionId?: string;
}

export class AdminCultureRegionDto extends CultureRegionInputDto implements AdminCultureRegion {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty({ type: RegionRefDto })
  region: RegionRefDto;
}

export class HolidayInputDto implements HolidayInput {
  @SlugField()
  slug: string;

  @UuidField()
  cultureId: string;

  @TextField()
  name: string;

  @TextField(LONG_TEXT_MAX)
  description: string;

  @ApiProperty({ enum: HolidayDateType })
  @IsEnum(HolidayDateType)
  dateType: HolidayDateType;

  @NullableIntField(1, 12)
  month: number | null = null;

  @NullableIntField(1, 31)
  day: number | null = null;

  @ApiPropertyOptional({ enum: Season, nullable: true })
  @IsOptional()
  @IsEnum(Season)
  season: Season | null = null;

  @NullableTextField(1000)
  dateNote: string | null = null;

  @NullableUuidField()
  cardId: string | null = null;

  @NullableUuidField()
  sourceId: string | null = null;
}

export class HolidaysAdminQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;
}

export class AdminHolidayDto extends HolidayInputDto implements AdminHoliday {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty({ type: AdminCardRefDto, nullable: true })
  card: AdminCardRefDto | null;
}
