import type { EraSummary } from '@atlas/shared';
import { ApiProperty } from '@nestjs/swagger';
import type { Era } from '../../generated/prisma/client';

export class EraDto implements EraSummary {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'antiquity' })
  slug: string;

  @ApiProperty({ example: 'Античность' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ example: -1200, description: 'Negative = BCE, no year 0' })
  startYear: number;

  @ApiProperty({ example: 476 })
  endYear: number;
}

export function toEraDto(era: Era): EraDto {
  return {
    id: era.id,
    slug: era.slug,
    name: era.name,
    description: era.description,
    startYear: era.startYear,
    endYear: era.endYear,
  };
}
