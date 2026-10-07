import type { AppLocale } from './constants.js';

/**
 * Historical years are stored as integers (DM-01):
 * negative values are BCE (-527 = 527 BCE), positive values are CE.
 * There is no year 0: the year after -1 is 1.
 */
export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year !== 0;
}

export function assertValidYear(year: number): void {
  if (!isValidYear(year)) {
    throw new RangeError(`Invalid historical year: ${year}. Expected a non-zero integer.`);
  }
}

/**
 * Formats a historical year for display.
 * RU: "527 г. до н. э." / "476 г. н. э."; EN: "527 BCE" / "476 CE".
 */
export function formatYear(year: number, locale: AppLocale = 'ru'): string {
  assertValidYear(year);
  const absolute = Math.abs(year);
  const isBce = year < 0;

  if (locale === 'en') {
    return `${absolute} ${isBce ? 'BCE' : 'CE'}`;
  }
  // Non-breaking spaces keep "г. до н. э." from wrapping onto a separate line.
  return isBce ? `${absolute}\u00a0г. до\u00a0н.\u00a0э.` : `${absolute}\u00a0г. н.\u00a0э.`;
}

/** Bounds accepted by the API for a "year" parameter; content stays well inside them. */
export const MIN_YEAR = -10000;
export const MAX_YEAR = 2100;

/**
 * Historical years have a gap at 0, which breaks arithmetic and range sliders.
 * The ordinal is a gap-free number line: ... -2, -1 (= 1 BCE), 0 (= 1 CE), 1 (= 2 CE) ...
 */
export function yearToOrdinal(year: number): number {
  assertValidYear(year);
  return year > 0 ? year - 1 : year;
}

export function ordinalToYear(ordinal: number): number {
  if (!Number.isInteger(ordinal)) {
    throw new RangeError(`Invalid year ordinal: ${ordinal}. Expected an integer.`);
  }
  return ordinal >= 0 ? ordinal + 1 : ordinal;
}

/** DM-03: a period [startYear, endYear] (both inclusive) contains the year. */
export function isYearInPeriod(year: number, startYear: number, endYear: number): boolean {
  return startYear <= year && year <= endYear;
}

/** The year closest to `year` inside [startYear, endYear]. */
export function clampYear(year: number, startYear: number, endYear: number): number {
  return Math.min(Math.max(year, startYear), endYear);
}

/** Middle of a period, never year 0 (used as the default year of an era). */
export function middleYear(startYear: number, endYear: number): number {
  const start = yearToOrdinal(startYear);
  const end = yearToOrdinal(endYear);
  return ordinalToYear(Math.floor((start + end) / 2));
}

/** A period for display: one year when start = end, otherwise "start – end". */
export function formatPeriod(startYear: number, endYear: number, locale: AppLocale = 'ru'): string {
  if (startYear === endYear) return formatYear(startYear, locale);
  return `${formatYear(startYear, locale)} – ${formatYear(endYear, locale)}`;
}
