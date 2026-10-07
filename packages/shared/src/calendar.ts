import type { CardListItem, CultureRef } from './atlas.js';
import type { HolidayDateType, Season } from './enums.js';

/** A day of the year without a year (holidays and "Today in history" repeat every year). */
export interface CalendarDate {
  month: number;
  day: number;
}

/** February has 29 days: a yearly date may fall on a leap day. */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function daysInMonth(month: number): number {
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

export function isValidCalendarDate(month: number, day: number): boolean {
  return Number.isInteger(month) && Number.isInteger(day) && day >= 1 && day <= daysInMonth(month);
}

/** Months of each season (Northern Hemisphere, meteorological seasons). */
export const SEASON_MONTHS: Record<Season, readonly number[]> = {
  WINTER: [12, 1, 2],
  SPRING: [3, 4, 5],
  SUMMER: [6, 7, 8],
  AUTUMN: [9, 10, 11],
};

export function seasonOfMonth(month: number): Season {
  const entry = Object.entries(SEASON_MONTHS).find(([, months]) => months.includes(month));
  if (!entry) throw new RangeError(`Invalid month: ${month}`);
  return entry[0] as Season;
}

/**
 * The Gregorian calendar was introduced in 1582. A day of an earlier event is a recalculation
 * from another calendar (Julian, Egyptian, Attic...), so it is shown as approximate (BR-15).
 */
export const GREGORIAN_REFORM_YEAR = 1582;

export function isRecalculatedDate(startYear: number): boolean {
  return startYear < GREGORIAN_REFORM_YEAR;
}

export interface Holiday {
  id: string;
  slug: string;
  name: string;
  description: string;
  dateType: HolidayDateType;
  /** EXACT only */
  month: number | null;
  day: number | null;
  /** SEASON only */
  season: Season | null;
  /** Why the date cannot be given exactly */
  dateNote: string | null;
  culture: CultureRef;
  /** The card about the holiday, if the user may open it */
  cardSlug: string | null;
}

export interface HolidaysQuery {
  cultureId?: string;
  /** EXACT holidays of the month and SEASON holidays of its season */
  month?: number;
}

export interface TodayHoliday extends Holiday {
  /** The day is a recalculation into the modern calendar (BR-15) */
  approximateDay: boolean;
}

export interface TodayCard extends CardListItem {
  month: number;
  day: number;
  approximateDay: boolean;
}

/**
 * "Today in history" (F-11). `date` is the day the entries belong to: today, or the nearest
 * following day that has entries when today has none; null when nothing is dated at all.
 */
export interface TodayInHistory {
  today: CalendarDate;
  date: CalendarDate | null;
  holidays: TodayHoliday[];
  cards: TodayCard[];
}

export function isSameCalendarDate(a: CalendarDate, b: CalendarDate): boolean {
  return a.month === b.month && a.day === b.day;
}
