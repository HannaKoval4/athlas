import type { CardType, CultureDetails, CultureSummary } from '@atlas/shared';
import { ApiProperty } from '@nestjs/swagger';
import type { Culture } from '../../../generated/prisma/client';

export class CultureSummaryDto implements CultureSummary {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ancient-greece' })
  slug: string;

  @ApiProperty({ example: 'Древняя Греция' })
  name: string;

  @ApiProperty({ example: '#2F6DB5' })
  color: string;

  @ApiProperty({ example: -3000 })
  startYear: number;

  @ApiProperty({ example: -146 })
  endYear: number;

  @ApiProperty({ description: 'The period is dated approximately (DM-04)' })
  dateApproximate: boolean;
}

export class CultureDetailsDto extends CultureSummaryDto implements CultureDetails {
  @ApiProperty()
  description: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: -450,
    description: 'Year the counts are for; null = all cards',
  })
  year: number | null;

  @ApiProperty({
    description: 'Visible cards per type, every type present',
    example: { MYTHOLOGY: 2, EVENT: 1, TRADITION: 2, FACT: 1, ARTWORK: 1, PERSON: 2, ARTIFACT: 0 },
  })
  cardCounts: Record<CardType, number>;

  @ApiProperty({ example: 9 })
  totalCards: number;
}

export function toCultureSummary(culture: Culture): CultureSummaryDto {
  return {
    id: culture.id,
    slug: culture.slug,
    name: culture.name,
    color: culture.color,
    startYear: culture.startYear,
    endYear: culture.endYear,
    dateApproximate: culture.dateApproximate,
  };
}
