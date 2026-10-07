import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IsHistoricalYear, PaginationQueryDto } from '../../../common/query.validators';
import { CardType } from '../../../generated/prisma/enums';

export class CardsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;

  @ApiPropertyOptional({ enum: CardType })
  @IsOptional()
  @IsEnum(CardType)
  type?: CardType;

  @ApiPropertyOptional({ example: -450, description: 'Only cards whose period contains the year' })
  @IsOptional()
  @IsHistoricalYear()
  year?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only cards whose period overlaps the era' })
  @IsOptional()
  @IsUUID()
  eraId?: string;
}
