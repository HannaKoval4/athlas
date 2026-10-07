import type {
  CardDetails,
  CardLinkRef,
  CardListItem,
  CardSourceRef,
  CultureRef,
  Paginated,
} from '@atlas/shared';
import { ApiProperty } from '@nestjs/swagger';
import { CardType, RelationType, SourceType } from '../../../generated/prisma/enums';

export class CultureRefDto implements CultureRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ancient-greece' })
  slug: string;

  @ApiProperty({ example: 'Древняя Греция' })
  name: string;

  @ApiProperty({ example: '#2F6DB5' })
  color: string;
}

export class CardListItemDto implements CardListItem {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'parthenon' })
  slug: string;

  @ApiProperty({ enum: CardType })
  type: CardType;

  @ApiProperty({ example: 'Парфенон' })
  title: string;

  @ApiProperty()
  summary: string;

  @ApiProperty({ example: -447 })
  startYear: number;

  @ApiProperty({ example: -432 })
  endYear: number;

  @ApiProperty({ description: 'Dating is approximate (DM-04)' })
  dateApproximate: boolean;

  @ApiProperty({ type: String, nullable: true })
  imageUrl: string | null;

  @ApiProperty({ description: 'Always true for users; admins also see drafts (BR-06)' })
  published: boolean;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;
}

export class CardPageDto implements Paginated<CardListItemDto> {
  @ApiProperty({ type: [CardListItemDto] })
  items: CardListItemDto[];

  @ApiProperty({ example: 15 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

export class CardSourceRefDto implements CardSourceRef {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: SourceType })
  type: SourceType;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: String, nullable: true })
  author: string | null;

  @ApiProperty({ type: String, nullable: true })
  publisher: string | null;

  @ApiProperty({ type: Number, nullable: true })
  year: number | null;

  @ApiProperty({ type: String, nullable: true })
  url: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Pages cited for this card' })
  pages: string | null;
}

class LinkedCardDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: CardType })
  type: CardType;
}

export class CardLinkRefDto implements CardLinkRef {
  @ApiProperty({
    enum: ['outgoing', 'incoming'],
    description: 'outgoing = this card is the link source (DM-06)',
  })
  direction: 'outgoing' | 'incoming';

  @ApiProperty({ enum: RelationType })
  relationType: RelationType;

  @ApiProperty({ type: LinkedCardDto })
  card: LinkedCardDto;
}

export class CardDetailsDto extends CardListItemDto implements CardDetails {
  @ApiProperty({ description: 'Markdown' })
  content: string;

  @ApiProperty({ type: Number, nullable: true })
  month: number | null;

  @ApiProperty({ type: Number, nullable: true })
  day: number | null;

  @ApiProperty({ type: String, nullable: true })
  imageCredit: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt: string | null;

  @ApiProperty({ type: [CardSourceRefDto] })
  sources: CardSourceRefDto[];

  @ApiProperty({ type: [CardLinkRefDto] })
  links: CardLinkRefDto[];
}
