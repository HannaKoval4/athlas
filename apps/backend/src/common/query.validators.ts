import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_YEAR, MIN_YEAR } from '@atlas/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, NotEquals } from 'class-validator';

/**
 * A historical year in a query string (DM-01): integer, no year 0, within sane bounds.
 * Query values arrive as strings, so the value is converted to a number first.
 */
export function IsHistoricalYear(): PropertyDecorator {
  return applyDecorators(
    Type(() => Number),
    IsInt({ message: '$property must be an integer' }),
    NotEquals(0, { message: 'year 0 does not exist' }),
    Min(MIN_YEAR),
    Max(MAX_YEAR),
  );
}

/** ?page=1&pageSize=20 (the API-wide pagination convention). */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;
}
