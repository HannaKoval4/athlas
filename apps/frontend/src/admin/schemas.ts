import {
  type AdminCard,
  type AdminCulture,
  type AdminCultureRegion,
  type AdminEra,
  type AdminHoliday,
  type AdminQuestion,
  type AdminQuiz,
  type AdminRegion,
  type AdminSource,
  CardType,
  HEX_COLOR_PATTERN,
  HolidayDateType,
  type RegionGeometry,
  RelationType,
  SLUG_MAX_LENGTH,
  Season,
  SLUG_PATTERN,
  SourceType,
  cardDayIssue,
  holidayDateIssue,
  isRegionGeometry,
  periodIssue,
  questionOptionsIssue,
} from '@atlas/shared';
import { z } from 'zod';
import type { ValidationKey } from '../i18n/index.ts';

/**
 * Admin forms. Inputs are edited as strings (an empty number field is "no value", not NaN),
 * the schemas turn them into the API's types and check the same cross-field rules as the server
 * (functions from @atlas/shared), so most mistakes are shown next to the field before saving.
 */

const msg = (key: ValidationKey) => key;

const SHORT = 200;
const LONG = 20_000;

const text = (max = SHORT) =>
  z.string().trim().min(1, msg('required')).max(max, msg('textTooLong'));
const optionalText = (max = SHORT) =>
  z
    .string()
    .trim()
    .max(max, msg('textTooLong'))
    .transform((value) => value || null);
const slug = z
  .string()
  .trim()
  .min(1, msg('required'))
  .max(SLUG_MAX_LENGTH, msg('textTooLong'))
  .regex(SLUG_PATTERN, msg('slugInvalid'));
const int = z
  .string()
  .trim()
  .min(1, msg('required'))
  .regex(/^-?\d+$/, msg('integer'))
  .transform(Number);
const optionalInt = z
  .string()
  .trim()
  .regex(/^(-?\d+)?$/, msg('integer'))
  .transform((value) => (value === '' ? null : Number(value)));
const decimal = z
  .string()
  .trim()
  .min(1, msg('required'))
  .regex(/^-?\d+(\.\d+)?$/, msg('number'))
  .transform(Number);
const id = z.string().min(1, msg('required'));
const optionalId = z.string().transform((value) => value || null);
const url = optionalText(1000).refine(
  (value) => value === null || /^https?:\/\/\S+$/.test(value),
  msg('urlInvalid'),
);

type Ctx = z.RefinementCtx;

/** DM-01, DM-02 on startYear/endYear; the message sits under the field to fix. */
function checkPeriod(value: { startYear: number; endYear: number }, ctx: Ctx): void {
  const issue = periodIssue(value.startYear, value.endYear);
  if (!issue) return;
  // A bad start year itself (0, out of range) is reported there; otherwise at the end year.
  const path = periodIssue(value.startYear, value.startYear) ? 'startYear' : 'endYear';
  ctx.addIssue({ code: 'custom', message: issue, path: [path] });
}

const str = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value);

// ---- Eras ----------------------------------------------------------------------------------

export const eraSchema = z
  .object({
    slug,
    name: text(),
    description: optionalText(LONG),
    startYear: int,
    endYear: int,
    sortOrder: int,
  })
  .superRefine(checkPeriod);

export type EraFormValues = z.input<typeof eraSchema>;

export function eraForm(era?: AdminEra): EraFormValues {
  return {
    slug: era?.slug ?? '',
    name: era?.name ?? '',
    description: era?.description ?? '',
    startYear: str(era?.startYear),
    endYear: str(era?.endYear),
    sortOrder: str(era?.sortOrder ?? 0),
  };
}

// ---- Cultures ------------------------------------------------------------------------------

export const cultureSchema = z
  .object({
    slug,
    name: text(),
    description: text(LONG),
    startYear: int,
    endYear: int,
    dateApproximate: z.boolean(),
    color: z.string().trim().regex(HEX_COLOR_PATTERN, msg('colorInvalid')),
    booksQuery: optionalText(),
  })
  .superRefine(checkPeriod);

export type CultureFormValues = z.input<typeof cultureSchema>;

export function cultureForm(culture?: AdminCulture): CultureFormValues {
  return {
    slug: culture?.slug ?? '',
    name: culture?.name ?? '',
    description: culture?.description ?? '',
    startYear: str(culture?.startYear),
    endYear: str(culture?.endYear),
    dateApproximate: culture?.dateApproximate ?? false,
    color: culture?.color ?? '#b45309',
    booksQuery: culture?.booksQuery ?? '',
  };
}

// ---- Regions -------------------------------------------------------------------------------

/** DM-10: the textarea holds GeoJSON; it must parse and be a Polygon or MultiPolygon. */
const geojson = z.string().transform((value, ctx): RegionGeometry => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: msg('jsonInvalid') });
    return z.NEVER;
  }
  if (!isRegionGeometry(parsed)) {
    ctx.addIssue({ code: 'custom', message: msg('geojsonInvalid') });
    return z.NEVER;
  }
  return parsed;
});

export const regionSchema = z.object({
  slug,
  name: text(),
  geojson,
  centerLat: decimal.refine((v) => v >= -90 && v <= 90, msg('latitudeInvalid')),
  centerLng: decimal.refine((v) => v >= -180 && v <= 180, msg('longitudeInvalid')),
});

export type RegionFormValues = z.input<typeof regionSchema>;

export function regionForm(region?: AdminRegion): RegionFormValues {
  return {
    slug: region?.slug ?? '',
    name: region?.name ?? '',
    geojson: region ? JSON.stringify(region.geojson, null, 2) : '',
    centerLat: str(region?.centerLat),
    centerLng: str(region?.centerLng),
  };
}

// ---- Culture presence in regions -----------------------------------------------------------

export const cultureRegionSchema = z
  .object({
    cultureId: id,
    regionId: id,
    startYear: int,
    endYear: int,
    dateApproximate: z.boolean(),
  })
  .superRefine(checkPeriod);

export type CultureRegionFormValues = z.input<typeof cultureRegionSchema>;

export function cultureRegionForm(period?: AdminCultureRegion): CultureRegionFormValues {
  return {
    cultureId: period?.cultureId ?? '',
    regionId: period?.regionId ?? '',
    startYear: str(period?.startYear),
    endYear: str(period?.endYear),
    dateApproximate: period?.dateApproximate ?? false,
  };
}

// ---- Cards ---------------------------------------------------------------------------------

export const cardSchema = z
  .object({
    slug,
    type: z.enum(CardType),
    title: text(),
    summary: text(1000),
    content: text(LONG),
    cultureId: id,
    startYear: int,
    endYear: int,
    month: optionalInt,
    day: optionalInt,
    dateApproximate: z.boolean(),
    imageUrl: url,
    imageCredit: optionalText(500),
    booksQuery: optionalText(),
  })
  .superRefine((value, ctx) => {
    checkPeriod(value, ctx);
    const issue = cardDayIssue(value.month, value.day);
    if (issue) ctx.addIssue({ code: 'custom', message: issue, path: ['day'] });
  });

export type CardFormValues = z.input<typeof cardSchema>;

export function cardForm(card?: AdminCard): CardFormValues {
  return {
    slug: card?.slug ?? '',
    type: card?.type ?? CardType.EVENT,
    title: card?.title ?? '',
    summary: card?.summary ?? '',
    content: card?.content ?? '',
    cultureId: card?.cultureId ?? '',
    startYear: str(card?.startYear),
    endYear: str(card?.endYear),
    month: str(card?.month),
    day: str(card?.day),
    dateApproximate: card?.dateApproximate ?? false,
    imageUrl: card?.imageUrl ?? '',
    imageCredit: card?.imageCredit ?? '',
    booksQuery: card?.booksQuery ?? '',
  };
}

export const linkSchema = z.object({
  toCardId: id,
  relationType: z.enum(RelationType),
});

export type LinkFormValues = z.input<typeof linkSchema>;

export const cardSourceSchema = z.object({
  sourceId: id,
  pages: optionalText(100),
});

export type CardSourceFormValues = z.input<typeof cardSourceSchema>;

// ---- Sources -------------------------------------------------------------------------------

export const sourceSchema = z.object({
  slug,
  type: z.enum(SourceType),
  title: text(500),
  author: optionalText(),
  publisher: optionalText(),
  year: optionalInt,
  url,
  accessedAt: z.string().transform((value) => value || null),
});

export type SourceFormValues = z.input<typeof sourceSchema>;

export function sourceForm(source?: AdminSource): SourceFormValues {
  return {
    slug: source?.slug ?? '',
    type: source?.type ?? SourceType.ENCYCLOPEDIA,
    title: source?.title ?? '',
    author: source?.author ?? '',
    publisher: source?.publisher ?? '',
    year: str(source?.year),
    url: source?.url ?? '',
    accessedAt: source?.accessedAt ?? '',
  };
}

// ---- Holidays (DM-05) ----------------------------------------------------------------------

export const holidaySchema = z
  .object({
    slug,
    cultureId: id,
    name: text(),
    description: text(LONG),
    dateType: z.enum(HolidayDateType),
    month: optionalInt,
    day: optionalInt,
    season: z.union([z.literal(''), z.enum(Season)]).transform((value) => value || null),
    dateNote: optionalText(1000),
    cardId: optionalId,
    sourceId: optionalId,
  })
  .superRefine((value, ctx) => {
    const issue = holidayDateIssue(value);
    if (!issue) return;
    const path = issue.startsWith('season') ? 'season' : 'day';
    ctx.addIssue({ code: 'custom', message: issue, path: [path] });
  });

export type HolidayFormValues = z.input<typeof holidaySchema>;

export function holidayForm(holiday?: AdminHoliday): HolidayFormValues {
  return {
    slug: holiday?.slug ?? '',
    cultureId: holiday?.cultureId ?? '',
    name: holiday?.name ?? '',
    description: holiday?.description ?? '',
    dateType: holiday?.dateType ?? HolidayDateType.EXACT,
    month: str(holiday?.month),
    day: str(holiday?.day),
    season: holiday?.season ?? '',
    dateNote: holiday?.dateNote ?? '',
    cardId: holiday?.cardId ?? '',
    sourceId: holiday?.sourceId ?? '',
  };
}

// ---- Quizzes and questions -----------------------------------------------------------------

export const quizSchema = z.object({
  eraId: id,
  cultureId: id,
  title: text(),
  questionsPerAttempt: int.refine((v) => v >= 1 && v <= 50, msg('questionsPerAttemptRange')),
  passPercent: int.refine((v) => v >= 1 && v <= 100, msg('passPercentRange')),
});

export type QuizFormValues = z.input<typeof quizSchema>;

export function quizForm(quiz?: AdminQuiz): QuizFormValues {
  return {
    eraId: quiz?.eraId ?? '',
    cultureId: quiz?.cultureId ?? '',
    title: quiz?.title ?? '',
    questionsPerAttempt: str(quiz?.questionsPerAttempt ?? 10),
    passPercent: str(quiz?.passPercent ?? 70),
  };
}

export const questionSchema = z
  .object({
    text: text(1000),
    explanation: text(LONG),
    multiple: z.boolean(),
    cardId: optionalId,
    options: z.array(
      // optionId, not id: useFieldArray uses `id` for its own row keys.
      z
        .object({ optionId: z.string(), text: text(500), isCorrect: z.boolean() })
        .transform(({ optionId, ...option }) => ({ ...option, id: optionId || undefined })),
    ),
  })
  .superRefine((value, ctx) => {
    const issue = questionOptionsIssue(value.multiple, value.options);
    if (issue) ctx.addIssue({ code: 'custom', message: issue, path: ['options'] });
  });

export type QuestionFormValues = z.input<typeof questionSchema>;

export function questionForm(question?: AdminQuestion): QuestionFormValues {
  return {
    text: question?.text ?? '',
    explanation: question?.explanation ?? '',
    multiple: question?.multiple ?? false,
    cardId: question?.cardId ?? '',
    options: question?.options.map(({ id: optionId, ...option }) => ({ optionId, ...option })) ?? [
      { optionId: '', text: '', isCorrect: true },
      { optionId: '', text: '', isCorrect: false },
    ],
  };
}
