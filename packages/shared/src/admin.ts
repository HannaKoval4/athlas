import type { CultureRef, RegionGeometry } from './atlas.js';
import { isValidCalendarDate } from './calendar.js';
import type { CardType, HolidayDateType, RelationType, Season, SourceType } from './enums.js';
import type { RegionRef } from './search.js';
import { MAX_YEAR, MIN_YEAR } from './year.js';

/**
 * Admin API (F-18): request and response shapes of /api/admin/*, and the cross-field rules
 * that both the API and the admin forms check. Writes use full objects (PUT), so every rule
 * can be checked on the request body alone.
 */

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 80;
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const ANSWER_OPTIONS_MIN = 2;
export const ANSWER_OPTIONS_MAX = 8;

// ---------------------------------------------------------------------------------------------
// Inputs and responses
// ---------------------------------------------------------------------------------------------

export interface EraInput {
  slug: string;
  name: string;
  description: string | null;
  startYear: number;
  endYear: number;
  sortOrder: number;
}

export interface AdminEra extends EraInput {
  id: string;
  quizCount: number;
}

export interface CultureInput {
  slug: string;
  name: string;
  description: string;
  startYear: number;
  endYear: number;
  dateApproximate: boolean;
  color: string;
  booksQuery: string | null;
}

export interface AdminCulture extends CultureInput {
  id: string;
  cardCount: number;
}

export interface RegionInput {
  slug: string;
  name: string;
  geojson: RegionGeometry;
  centerLat: number;
  centerLng: number;
}

export interface AdminRegion extends RegionInput {
  id: string;
  /** Number of culture-region periods; they are deleted together with the region */
  periodCount: number;
}

export interface CultureRegionInput {
  cultureId: string;
  regionId: string;
  startYear: number;
  endYear: number;
  dateApproximate: boolean;
}

export interface AdminCultureRegion extends CultureRegionInput {
  id: string;
  culture: CultureRef;
  region: RegionRef;
}

export interface CardInput {
  slug: string;
  type: CardType;
  title: string;
  summary: string;
  /** Markdown */
  content: string;
  cultureId: string;
  startYear: number;
  endYear: number;
  /** Both or neither (CHECK card_date_chk) */
  month: number | null;
  day: number | null;
  dateApproximate: boolean;
  imageUrl: string | null;
  imageCredit: string | null;
  booksQuery: string | null;
}

export interface AdminCardRef {
  id: string;
  slug: string;
  title: string;
}

export interface AdminCardListItem extends AdminCardRef {
  type: CardType;
  culture: CultureRef;
  startYear: number;
  endYear: number;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface AdminCardsQuery {
  page?: number;
  pageSize?: number;
  /** Case-insensitive part of the title or slug */
  q?: string;
  cultureId?: string;
  type?: CardType;
  published?: boolean;
}

export interface CardLinkInput {
  fromCardId: string;
  toCardId: string;
  relationType: RelationType;
}

export interface AdminCardLink extends CardLinkInput {
  from: AdminCardRef;
  to: AdminCardRef;
}

export interface SourceInput {
  slug: string;
  type: SourceType;
  title: string;
  author: string | null;
  publisher: string | null;
  year: number | null;
  url: string | null;
  /** ISO date (YYYY-MM-DD) */
  accessedAt: string | null;
}

export interface AdminSource extends SourceInput {
  id: string;
  cardCount: number;
}

export interface SourceRef {
  id: string;
  slug: string;
  title: string;
  type: SourceType;
}

export interface CardSourceInput {
  cardId: string;
  sourceId: string;
  pages: string | null;
}

export interface AdminCardSource extends CardSourceInput {
  source: SourceRef;
}

export interface AdminCard extends CardInput {
  id: string;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  culture: CultureRef;
  /** Links in both directions (DM-06) */
  links: AdminCardLink[];
  sources: AdminCardSource[];
}

export interface HolidayInput {
  slug: string;
  cultureId: string;
  name: string;
  description: string;
  dateType: HolidayDateType;
  /** EXACT only */
  month: number | null;
  day: number | null;
  /** SEASON only */
  season: Season | null;
  /** Why the date is not exact (any type except EXACT) */
  dateNote: string | null;
  cardId: string | null;
  sourceId: string | null;
}

export interface AdminHoliday extends HolidayInput {
  id: string;
  culture: CultureRef;
  card: AdminCardRef | null;
}

export interface QuizInput {
  eraId: string;
  cultureId: string;
  title: string;
  questionsPerAttempt: number;
  passPercent: number;
}

export interface AdminQuiz extends QuizInput {
  id: string;
  era: { id: string; slug: string; name: string };
  culture: CultureRef;
  questionCount: number;
}

export interface AnswerOptionInput {
  /** Present for an existing option: it is updated in place, so past attempts keep their review */
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionInput {
  quizId: string;
  text: string;
  explanation: string;
  multiple: boolean;
  /** Card to revisit after a wrong answer (BR-14) */
  cardId: string | null;
  options: AnswerOptionInput[];
}

export interface AdminAnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface AdminQuestion extends Omit<QuestionInput, 'options'> {
  id: string;
  card: AdminCardRef | null;
  options: AdminAnswerOption[];
}

// ---------------------------------------------------------------------------------------------
// Cross-field rules. Each returns null when the input is valid, otherwise an issue code
// (the API turns it into a 400 message, the forms into a translated hint).
// ---------------------------------------------------------------------------------------------

export type PeriodIssue = 'yearZero' | 'yearOutOfRange' | 'endBeforeStart';

/** DM-01, DM-02: integer years, no year 0, start <= end. */
export function periodIssue(startYear: number, endYear: number): PeriodIssue | null {
  const years = [startYear, endYear];
  if (years.some((year) => !Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR)) {
    return 'yearOutOfRange';
  }
  if (years.includes(0)) return 'yearZero';
  return startYear <= endYear ? null : 'endBeforeStart';
}

export type CalendarDayIssue = 'dayIncomplete' | 'dayInvalid';

/** Card day of the year: both month and day or neither, and a real calendar day. */
export function cardDayIssue(month: number | null, day: number | null): CalendarDayIssue | null {
  if (month === null && day === null) return null;
  if (month === null || day === null) return 'dayIncomplete';
  return isValidCalendarDate(month, day) ? null : 'dayInvalid';
}

export type HolidayDateIssue =
  | CalendarDayIssue
  | 'exactNeedsDay'
  | 'dayOnlyForExact'
  | 'seasonNeedsSeason'
  | 'seasonOnlyForSeason';

/** DM-05: month/day only (and always) for EXACT, season only (and always) for SEASON. */
export function holidayDateIssue(
  input: Pick<HolidayInput, 'dateType' | 'month' | 'day' | 'season'>,
): HolidayDateIssue | null {
  const hasDay = input.month !== null || input.day !== null;
  if (input.dateType === 'EXACT') {
    if (!hasDay) return 'exactNeedsDay';
    const issue = cardDayIssue(input.month, input.day);
    if (issue) return issue;
  } else if (hasDay) {
    return 'dayOnlyForExact';
  }
  if (input.dateType === 'SEASON') return input.season === null ? 'seasonNeedsSeason' : null;
  return input.season === null ? null : 'seasonOnlyForSeason';
}

export type QuestionOptionsIssue =
  | 'tooFewOptions'
  | 'tooManyOptions'
  | 'noCorrectOption'
  | 'singleNeedsOneCorrect'
  | 'duplicateOption';

/** A question has 2-8 distinct options, at least one correct; a single-choice one has exactly one. */
export function questionOptionsIssue(
  multiple: boolean,
  options: readonly Pick<AnswerOptionInput, 'text' | 'isCorrect'>[],
): QuestionOptionsIssue | null {
  if (options.length < ANSWER_OPTIONS_MIN) return 'tooFewOptions';
  if (options.length > ANSWER_OPTIONS_MAX) return 'tooManyOptions';
  const texts = options.map((option) => option.text.trim().toLowerCase());
  if (new Set(texts).size !== texts.length) return 'duplicateOption';
  const correct = options.filter((option) => option.isCorrect).length;
  if (correct === 0) return 'noCorrectOption';
  return !multiple && correct !== 1 ? 'singleNeedsOneCorrect' : null;
}

/** DM-10: the stored region shape is a GeoJSON Polygon or MultiPolygon of [lng, lat] points. */
export function isRegionGeometry(value: unknown): value is RegionGeometry {
  if (typeof value !== 'object' || value === null) return false;
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown };
  const isPoint = (p: unknown) =>
    Array.isArray(p) &&
    p.length >= 2 &&
    p.every((n) => typeof n === 'number' && Number.isFinite(n));
  // A linear ring is closed, so it has at least 4 points.
  const isRing = (r: unknown) => Array.isArray(r) && r.length >= 4 && r.every(isPoint);
  const isPolygon = (p: unknown) => Array.isArray(p) && p.length >= 1 && p.every(isRing);
  if (type === 'Polygon') return isPolygon(coordinates);
  if (type === 'MultiPolygon') {
    return Array.isArray(coordinates) && coordinates.length >= 1 && coordinates.every(isPolygon);
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------------------------

const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Suggested slug for a (usually Russian) title: "Храм Зевса" -> "khram-zevsa". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC[char] ?? char)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
}
