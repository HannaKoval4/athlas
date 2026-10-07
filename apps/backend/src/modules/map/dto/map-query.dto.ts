import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches, MaxLength } from 'class-validator';
import { IsHistoricalYear } from '../../../common/query.validators';

export class MapQueryDto {
  @ApiProperty({ example: -450, description: 'Negative = BCE; there is no year 0 (DM-01)' })
  @IsHistoricalYear()
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
