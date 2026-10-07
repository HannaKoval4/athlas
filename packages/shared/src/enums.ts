// Domain enums shared by backend and frontend. Values mirror the Prisma enums one-to-one;
// a backend unit test fails if they drift apart.

export const CardType = {
  MYTHOLOGY: 'MYTHOLOGY',
  EVENT: 'EVENT',
  TRADITION: 'TRADITION',
  FACT: 'FACT',
  ARTWORK: 'ARTWORK',
  PERSON: 'PERSON',
  ARTIFACT: 'ARTIFACT',
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];

export const RelationType = {
  RELATED: 'RELATED',
  PART_OF: 'PART_OF',
  DEPICTS: 'DEPICTS',
  CREATED_BY: 'CREATED_BY',
  CELEBRATES: 'CELEBRATES',
  MENTIONS: 'MENTIONS',
} as const;
export type RelationType = (typeof RelationType)[keyof typeof RelationType];

export const HolidayDateType = {
  EXACT: 'EXACT',
  SEASON: 'SEASON',
  MOVABLE: 'MOVABLE',
  APPROXIMATE: 'APPROXIMATE',
} as const;
export type HolidayDateType = (typeof HolidayDateType)[keyof typeof HolidayDateType];

export const Season = {
  SPRING: 'SPRING',
  SUMMER: 'SUMMER',
  AUTUMN: 'AUTUMN',
  WINTER: 'WINTER',
} as const;
export type Season = (typeof Season)[keyof typeof Season];

export const SourceType = {
  BOOK: 'BOOK',
  ARTICLE: 'ARTICLE',
  ENCYCLOPEDIA: 'ENCYCLOPEDIA',
  MUSEUM: 'MUSEUM',
  WEBSITE: 'WEBSITE',
} as const;
export type SourceType = (typeof SourceType)[keyof typeof SourceType];

export const Role = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ThemePreference = {
  LIGHT: 'LIGHT',
  DARK: 'DARK',
  SYSTEM: 'SYSTEM',
} as const;
export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference];

export const Locale = {
  RU: 'RU',
  EN: 'EN',
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

/** Display order of card tabs in the culture panel. */
export const CARD_TYPES: readonly CardType[] = Object.values(CardType);
