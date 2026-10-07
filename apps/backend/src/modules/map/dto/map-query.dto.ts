import { MAX_YEAR, MIN_YEAR } from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, MaxLength, Min, NotEquals } from 'class-validator';

export class MapQueryDto {
  @ApiProperty({ example: -450, description: 'Negative = BCE; there is no year 0 (DM-01)' })
  @Type(() => Number)
  @IsInt({ message: 'year must be an integer' })
  @NotEquals(0, { message: 'year 0 does not exist' })
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  year: number;

  @ApiPropertyOptional({
    example: 'antiquity',
    description: 'Era slug; when given, the year must lie inside the era (BR-05)',
  })
  @IsOptional()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, { message: 'era must be a slug' })
  era?: string;
}
