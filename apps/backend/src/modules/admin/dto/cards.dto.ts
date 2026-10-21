import type {
  AdminCard,
  AdminCardLink,
  AdminCardListItem,
  AdminCardRef,
  AdminCardSource,
  AdminCardsQuery,
  AdminSource,
  CardInput,
  CardLinkInput,
  CardSourceInput,
  Paginated,
  SourceInput,
  SourceRef,
} from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/query.validators';
import { CardType, RelationType, SourceType } from '../../../generated/prisma/enums';
import { CultureRefDto } from '../../cards/dto/card.dto';
import {
  BooleanField,
  LONG_TEXT_MAX,
  NullableIntField,
  NullableTextField,
  SHORT_TEXT_MAX,
  SlugField,
  TextField,
  UuidField,
  YearField,
} from './admin-fields';

const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

export class CardInputDto implements CardInput {
  @SlugField()
  slug: string;

  @ApiProperty({ enum: CardType })
  @IsEnum(CardType)
  type: CardType;

  @TextField()
  title: string;

  @TextField(1000)
  summary: string;

  @TextField(LONG_TEXT_MAX)
  content: string;

  @UuidField()
  cultureId: string;

  @YearField()
  startYear: number;

  @YearField()
  endYear: number;

  @NullableIntField(1, 12)
  month: number | null = null;

  @NullableIntField(1, 31)
  day: number | null = null;

  @BooleanField()
  dateApproximate: boolean;

  @NullableTextField(1000)
  @IsUrl(URL_OPTIONS)
  imageUrl: string | null = null;

  @NullableTextField(500)
  imageCredit: string | null = null;

  @NullableTextField()
  booksQuery: string | null = null;
}

export class AdminCardRefDto implements AdminCardRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;
}

export class AdminCardListItemDto extends AdminCardRefDto implements AdminCardListItem {
  @ApiProperty({ enum: CardType })
  type: CardType;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty()
  startYear: number;

  @ApiProperty()
  endYear: number;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class AdminCardPageDto implements Paginated<AdminCardListItemDto> {
  @ApiProperty({ type: [AdminCardListItemDto] })
  items: AdminCardListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class AdminCardsQueryDto extends PaginationQueryDto implements AdminCardsQuery {
  @ApiPropertyOptional({ description: 'Part of the title or slug, case-insensitive' })
  @IsOptional()
  @IsString()
  @MaxLength(SHORT_TEXT_MAX)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;

  @ApiPropertyOptional({ enum: CardType })
  @IsOptional()
  @IsEnum(CardType)
  type?: CardType;

  @ApiPropertyOptional({ description: 'true = published only, false = drafts only' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  published?: boolean;
}

export class CardLinkInputDto implements CardLinkInput {
  @UuidField()
  fromCardId: string;

  @UuidField()
  toCardId: string;

  @ApiProperty({ enum: RelationType })
  @IsEnum(RelationType)
  relationType: RelationType;
}

export class AdminCardLinkDto extends CardLinkInputDto implements AdminCardLink {
  @ApiProperty({ type: AdminCardRefDto })
  from: AdminCardRefDto;

  @ApiProperty({ type: AdminCardRefDto })
  to: AdminCardRefDto;
}

export class SourceInputDto implements SourceInput {
  @SlugField()
  slug: string;

  @ApiProperty({ enum: SourceType })
  @IsEnum(SourceType)
  type: SourceType;

  @TextField(500)
  title: string;

  @NullableTextField()
  author: string | null = null;

  @NullableTextField()
  publisher: string | null = null;

  @NullableIntField(-3000, 2100)
  year: number | null = null;

  @NullableTextField(1000)
  @IsUrl(URL_OPTIONS)
  url: string | null = null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true, example: '2026-10-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  accessedAt: string | null = null;
}

export class AdminSourceDto extends SourceInputDto implements AdminSource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Cards citing the source; a cited source cannot be deleted' })
  cardCount: number;
}

export class SourceRefDto implements SourceRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: SourceType })
  type: SourceType;
}

export class CardSourcePagesDto {
  @NullableTextField(100)
  pages: string | null = null;
}

export class CardSourceInputDto extends CardSourcePagesDto implements CardSourceInput {
  @UuidField()
  cardId: string;

  @UuidField()
  sourceId: string;
}

export class AdminCardSourceDto extends CardSourceInputDto implements AdminCardSource {
  @ApiProperty({ type: SourceRefDto })
  source: SourceRefDto;
}

export class AdminCardDto extends CardInputDto implements AdminCard {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  published: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty({ type: [AdminCardLinkDto], description: 'Links in both directions (DM-06)' })
  links: AdminCardLinkDto[];

  @ApiProperty({ type: [AdminCardSourceDto] })
  sources: AdminCardSourceDto[];
}
