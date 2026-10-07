import {
  type CardSearchHit,
  type CultureSearchHit,
  type HolidaySearchHit,
  type RegionRef,
  SEARCH_QUERY_MAX_LENGTH,
  type SearchResults,
} from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CardType, HolidayDateType, Season } from '../../../generated/prisma/enums';
import { IsHistoricalYear, PaginationQueryDto } from '../../../common/query.validators';
import { CardListItemDto, CultureRefDto } from '../../cards/dto/card.dto';

export class SearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    maxLength: SEARCH_QUERY_MAX_LENGTH,
    example: 'афин',
    description: 'Words to find; each word also matches as a prefix',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(SEARCH_QUERY_MAX_LENGTH)
  q?: string;

  @ApiPropertyOptional({ enum: CardType, description: 'Only cards of this type are searched' })
  @IsOptional()
  @IsEnum(CardType)
  type?: CardType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  regionId?: string;

  @ApiPropertyOptional({ example: -500, description: 'Period overlaps [yearFrom, yearTo]' })
  @IsOptional()
  @IsHistoricalYear()
  yearFrom?: number;

  @ApiPropertyOptional({ example: -400 })
  @IsOptional()
  @IsHistoricalYear()
  yearTo?: number;
}

export class CardSearchHitDto extends CardListItemDto implements CardSearchHit {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Text fragment; found words are wrapped in U+E000 … U+E001',
  })
  snippet: string | null;
}

export class CardSearchPageDto {
  @ApiProperty({ type: [CardSearchHitDto] })
  items: CardSearchHitDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class CultureSearchHitDto extends CultureRefDto implements CultureSearchHit {
  @ApiProperty()
  startYear: number;

  @ApiProperty()
  endYear: number;

  @ApiProperty()
  dateApproximate: boolean;

  @ApiProperty({ type: String, nullable: true })
  snippet: string | null;
}

export class HolidaySearchHitDto implements HolidaySearchHit {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: HolidayDateType })
  dateType: HolidayDateType;

  @ApiProperty({ type: Number, nullable: true })
  month: number | null;

  @ApiProperty({ type: Number, nullable: true })
  day: number | null;

  @ApiProperty({ enum: Season, nullable: true })
  season: Season | null;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty({ type: String, nullable: true })
  cardSlug: string | null;

  @ApiProperty({ type: String, nullable: true })
  snippet: string | null;
}

export class SearchResultsDto implements SearchResults {
  @ApiProperty({ type: CardSearchPageDto })
  cards: CardSearchPageDto;

  @ApiProperty({ type: [CultureSearchHitDto] })
  cultures: CultureSearchHitDto[];

  @ApiProperty({ type: [HolidaySearchHitDto] })
  holidays: HolidaySearchHitDto[];
}

export class RegionRefDto implements RegionRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'attica' })
  slug: string;

  @ApiProperty({ example: 'Аттика' })
  name: string;
}
