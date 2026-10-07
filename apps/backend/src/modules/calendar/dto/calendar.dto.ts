import type {
  CalendarDate,
  Holiday,
  HolidaysQuery,
  TodayCard,
  TodayHoliday,
  TodayInHistory,
} from '@atlas/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { HolidayDateType, Season } from '../../../generated/prisma/enums';
import { CardListItemDto, CultureRefDto } from '../../cards/dto/card.dto';

/** A month number in a query string (1-12). */
function IsMonth(): PropertyDecorator {
  return applyDecorators(
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(12),
  );
}

export class TodayQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 12,
    description: "The user's local date; both month and day, or neither (server date)",
  })
  @IsOptional()
  @IsMonth()
  month?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  day?: number;
}

export class HolidaysQueryDto implements HolidaysQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  cultureId?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 12,
    description: 'EXACT holidays of the month and SEASON holidays of its season',
  })
  @IsOptional()
  @IsMonth()
  month?: number;
}

export class CalendarDateDto implements CalendarDate {
  @ApiProperty({ example: 9 })
  month: number;

  @ApiProperty({ example: 12 })
  day: number;
}

export class HolidayDto implements Holiday {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'great-dionysia' })
  slug: string;

  @ApiProperty({ example: 'Великие Дионисии' })
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: HolidayDateType })
  dateType: HolidayDateType;

  @ApiProperty({ type: Number, nullable: true })
  month: number | null;

  @ApiProperty({ type: Number, nullable: true })
  day: number | null;

  @ApiProperty({ enum: Season, nullable: true })
  season: Season | null;

  @ApiProperty({ type: String, nullable: true })
  dateNote: string | null;

  @ApiProperty({ type: CultureRefDto })
  culture: CultureRefDto;

  @ApiProperty({ type: String, nullable: true })
  cardSlug: string | null;
}

export class TodayHolidayDto extends HolidayDto implements TodayHoliday {
  @ApiProperty({ description: 'The day is a recalculation into the modern calendar (BR-15)' })
  approximateDay: boolean;
}

export class TodayCardDto extends CardListItemDto implements TodayCard {
  @ApiProperty()
  month: number;

  @ApiProperty()
  day: number;

  @ApiProperty({ description: 'The day is a recalculation into the modern calendar (BR-15)' })
  approximateDay: boolean;
}

export class TodayInHistoryDto implements TodayInHistory {
  @ApiProperty({ type: CalendarDateDto })
  today: CalendarDateDto;

  @ApiProperty({
    type: CalendarDateDto,
    nullable: true,
    description: 'Today, or the nearest following day with entries; null if nothing is dated',
  })
  date: CalendarDateDto | null;

  @ApiProperty({ type: [TodayHolidayDto] })
  holidays: TodayHolidayDto[];

  @ApiProperty({ type: [TodayCardDto] })
  cards: TodayCardDto[];
}
