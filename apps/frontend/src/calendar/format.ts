import type { CalendarDate, Holiday } from '@atlas/shared';
import type { TFunction } from 'i18next';

// Any leap year: only the day and the month are shown, and 29 February must exist.
const LEAP_YEAR = 2000;

/** "12 сентября" / "September 12". */
export function formatCalendarDate(date: CalendarDate, locale: string): string {
  return new Date(LEAP_YEAR, date.month - 1, date.day).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
  });
}

/** Standalone month name: "Сентябрь" / "September". */
export function formatMonth(month: number, locale: string): string {
  const name = new Date(LEAP_YEAR, month - 1, 1).toLocaleDateString(locale, { month: 'long' });
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** When the holiday is celebrated: the day, the season, or why the date is not fixed. */
export function holidayDateLabel(
  holiday: Pick<Holiday, 'dateType' | 'month' | 'day' | 'season'>,
  t: TFunction,
  locale: string,
): string {
  if (holiday.dateType === 'EXACT' && holiday.month && holiday.day) {
    return formatCalendarDate({ month: holiday.month, day: holiday.day }, locale);
  }
  if (holiday.dateType === 'SEASON' && holiday.season) {
    return `${t('holidayDateType.SEASON')}: ${t(`season.${holiday.season}`)}`;
  }
  return t(`holidayDateType.${holiday.dateType}`);
}
