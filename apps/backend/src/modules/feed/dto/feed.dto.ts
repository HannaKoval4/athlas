import { FEED_DEFAULT_LIMIT, FEED_MAX_LIMIT, type FeedCard } from '@atlas/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CardListItemDto } from '../../cards/dto/card.dto';

export class FeedQueryDto {
  @ApiPropertyOptional({ default: FEED_DEFAULT_LIMIT, minimum: 1, maximum: FEED_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEED_MAX_LIMIT)
  limit: number = FEED_DEFAULT_LIMIT;
}

export class FeedCardDto extends CardListItemDto implements FeedCard {
  @ApiProperty({ format: 'date-time' })
  publishedAt: string;
}
