import type { CardListItem, CultureRef, Paginated } from './atlas.js';
import type { HolidayDateType, Season } from './enums.js';

export const SEARCH_QUERY_MAX_LENGTH = 100;
/** Cultures and holidays are few; the search returns at most this many of each. */
export const SEARCH_GROUP_LIMIT = 10;

/**
 * Snippets mark found words with these private-use characters instead of HTML tags,
 * so the client can highlight them without rendering any HTML from the server.
 */
export const HIGHLIGHT_START = '';
export const HIGHLIGHT_END = '';

export interface SearchQuery {
  q?: string;
  type?: CardListItem['type'];
  cultureId?: string;
  regionId?: string;
  yearFrom?: number;
  yearTo?: number;
  page?: number;
  pageSize?: number;
}

export interface CardSearchHit extends CardListItem {
  /** Fragment of the text around the found words; null without a text query */
  snippet: string | null;
}

export interface CultureSearchHit extends CultureRef {
  startYear: number;
  endYear: number;
  dateApproximate: boolean;
  snippet: string | null;
}

export interface HolidaySearchHit {
  id: string;
  slug: string;
  name: string;
  dateType: HolidayDateType;
  month: number | null;
  day: number | null;
  season: Season | null;
  culture: CultureRef;
  /** The card about the holiday, if there is one */
  cardSlug: string | null;
  snippet: string | null;
}

/** Results grouped by entity (cards are paginated, the other groups are short). */
export interface SearchResults {
  cards: Paginated<CardSearchHit>;
  cultures: CultureSearchHit[];
  holidays: HolidaySearchHit[];
}

export interface RegionRef {
  id: string;
  slug: string;
  name: string;
}

export interface SnippetPart {
  text: string;
  highlighted: boolean;
}

/** Splits a snippet into plain and highlighted parts (see HIGHLIGHT_START). */
export function splitHighlights(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  for (const [index, chunk] of snippet.split(HIGHLIGHT_START).entries()) {
    if (index === 0) {
      if (chunk) parts.push({ text: chunk, highlighted: false });
      continue;
    }
    const end = chunk.indexOf(HIGHLIGHT_END);
    const marked = end === -1 ? chunk : chunk.slice(0, end);
    const rest = end === -1 ? '' : chunk.slice(end + HIGHLIGHT_END.length);
    if (marked) parts.push({ text: marked, highlighted: true });
    if (rest) parts.push({ text: rest, highlighted: false });
  }
  return parts;
}
