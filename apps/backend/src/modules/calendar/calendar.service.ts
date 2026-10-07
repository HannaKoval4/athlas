import {
  type CalendarDate,
  isRecalculatedDate,
  isValidCalendarDate,
  seasonOfMonth,
} from '@atlas/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { HolidayDateType, Season } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { visibleCards } from '../cards/card-visibility';
import { cardListSelect, cultureRefSelect } from '../cards/cards.service';
import type {
  HolidayDto,
  HolidaysQueryDto,
  TodayCardDto,
  TodayHolidayDto,
  TodayInHistoryDto,
  TodayQueryDto,
} from './dto/calendar.dto';

const holidaySelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  dateType: true,
  month: true,
  day: true,
  season: true,
  dateNote: true,
  // startYear: the day of an ancient culture's holiday is a recalculation (BR-15).
  culture: { select: { ...cultureRefSelect, startYear: true } },
  card: { select: { slug: true, published: true } },
} satisfies Prisma.HolidaySelect;

type HolidayRow = Prisma.HolidayGetPayload<{ select: typeof holidaySelect }>;

const DATE_TYPE_ORDER: readonly HolidayDateType[] = Object.values(HolidayDateType);
const SEASON_ORDER: readonly Season[] = Object.values(Season);

/**
 * Calendar order: exact dates by day of the year, then seasonal holidays by season, then
 * movable and approximate ones; ties by name.
 */
export function compareHolidays(a: HolidayDto, b: HolidayDto): number {
  const byType = DATE_TYPE_ORDER.indexOf(a.dateType) - DATE_TYPE_ORDER.indexOf(b.dateType);
  if (byType !== 0) return byType;
  const byDate = (a.month ?? 0) * 100 + (a.day ?? 0) - ((b.month ?? 0) * 100 + (b.day ?? 0));
  if (byDate !== 0) return byDate;
  const bySeason =
    (a.season ? SEASON_ORDER.indexOf(a.season) : 0) -
    (b.season ? SEASON_ORDER.indexOf(b.season) : 0);
  if (bySeason !== 0) return bySeason;
  return a.name.localeCompare(b.name, 'ru');
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * F-10: holidays of all date types. With a month: EXACT holidays of that month and SEASON
   * holidays of its season; movable and approximate holidays cannot be placed in a month.
   */
  async findHolidays(query: HolidaysQueryDto, includeDrafts: boolean): Promise<HolidayDto[]> {
    const where: Prisma.HolidayWhereInput = {};
    if (query.cultureId) where.cultureId = query.cultureId;
    if (query.month !== undefined) {
      where.OR = [
        { dateType: HolidayDateType.EXACT, month: query.month },
        { dateType: HolidayDateType.SEASON, season: seasonOfMonth(query.month) },
      ];
    }
    const rows = await this.prisma.holiday.findMany({ where, select: holidaySelect });
    return rows.map((row) => toHoliday(row, includeDrafts)).sort(compareHolidays);
  }

  /**
   * F-11 "Today in history": EXACT holidays and dated cards of the day (BR-15). When the day
   * has nothing, the nearest following day with entries is shown instead, so the block is
   * never empty while anything is dated.
   * `today` is the user's local date sent by the client; the server date is the fallback.
   */
  async today(
    query: TodayQueryDto,
    includeDrafts: boolean,
    now: Date = new Date(),
  ): Promise<TodayInHistoryDto> {
    if ((query.month === undefined) !== (query.day === undefined)) {
      throw new BadRequestException('month and day must be given together');
    }
    const today: CalendarDate =
      query.month !== undefined && query.day !== undefined
        ? { month: query.month, day: query.day }
        : { month: now.getMonth() + 1, day: now.getDate() };
    if (!isValidCalendarDate(today.month, today.day)) {
      throw new BadRequestException(`There is no day ${today.day} in month ${today.month}`);
    }

    const date = await this.findNearestDatedDay(today, includeDrafts);
    if (!date) return { today, date: null, holidays: [], cards: [] };

    const [holidays, cards] = await Promise.all([
      this.prisma.holiday.findMany({
        where: { dateType: HolidayDateType.EXACT, month: date.month, day: date.day },
        select: holidaySelect,
        orderBy: { name: 'asc' },
      }),
      this.prisma.card.findMany({
        where: { ...visibleCards(includeDrafts), month: date.month, day: date.day },
        select: { ...cardListSelect, month: true, day: true },
        orderBy: [{ startYear: 'asc' }, { title: 'asc' }],
      }),
    ]);

    return {
      today,
      date,
      holidays: holidays.map((row): TodayHolidayDto => ({
        ...toHoliday(row, includeDrafts),
        approximateDay: isRecalculatedDate(row.culture.startYear),
      })),
      cards: cards.map(({ month, day, ...card }): TodayCardDto => ({
        ...card,
        // Both are set: the query selects cards of this very day.
        month: month ?? date.month,
        day: day ?? date.day,
        approximateDay: card.dateApproximate || isRecalculatedDate(card.startYear),
      })),
    };
  }

  /**
   * The first day, starting from `from` and wrapping around the end of the year, on which an
   * EXACT holiday or a visible dated card falls. Days are compared as month * 100 + day:
   * days before `from` sort after the rest of the year (false < true).
   */
  private async findNearestDatedDay(
    from: CalendarDate,
    includeDrafts: boolean,
  ): Promise<CalendarDate | null> {
    const fromKey = from.month * 100 + from.day;
    const cardVisible = includeDrafts ? Prisma.sql`TRUE` : Prisma.sql`published`;
    const rows = await this.prisma.$queryRaw<CalendarDate[]>`
      SELECT month, day
      FROM (
        SELECT month, day FROM "Holiday"
        WHERE "dateType" = 'EXACT'
        UNION
        SELECT month, day FROM "Card"
        WHERE month IS NOT NULL AND day IS NOT NULL AND ${cardVisible}
      ) AS dated
      ORDER BY (month * 100 + day < ${fromKey}), month, day
      LIMIT 1`;
    return rows[0] ?? null;
  }
}

function toHoliday(row: HolidayRow, includeDrafts: boolean): HolidayDto {
  const { card, culture, ...holiday } = row;
  return {
    ...holiday,
    culture: { id: culture.id, slug: culture.slug, name: culture.name, color: culture.color },
    cardSlug: card && (includeDrafts || card.published) ? card.slug : null,
  };
}
