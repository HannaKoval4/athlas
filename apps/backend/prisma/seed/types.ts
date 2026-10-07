import type {
  CardType,
  HolidayDateType,
  RelationType,
  Season,
  SourceType,
} from '../../src/generated/prisma/enums';

/**
 * Shapes of the seed JSON files. Any entity may carry `verify`: a note for the author
 * about a fact, date or reference that needs manual checking before the defense.
 */
interface Verifiable {
  verify?: string;
}

export interface SeedEra extends Verifiable {
  slug: string;
  name: string;
  description?: string;
  startYear: number;
  endYear: number;
  sortOrder: number;
}

/** A region file is a GeoJSON Feature; properties carry our metadata. */
export interface SeedRegion extends Verifiable {
  slug: string;
  name: string;
  centerLat: number;
  centerLng: number;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
}

export interface SeedSource extends Verifiable {
  slug: string;
  type: SourceType;
  title: string;
  author?: string;
  publisher?: string;
  year?: number;
  url?: string;
}

export interface SeedCultureRegion extends Verifiable {
  region: string;
  startYear: number;
  endYear: number;
  dateApproximate?: boolean;
}

/** Illustration from Wikimedia Commons; credit is Markdown (author · licence · link to the file page). */
export interface SeedCardImage extends Verifiable {
  url: string;
  credit: string;
}

export interface SeedCard extends Verifiable {
  slug: string;
  type: CardType;
  title: string;
  summary: string;
  /** Markdown paragraphs (joined with blank lines); an array keeps the JSON free of escapes. */
  content: string[];
  startYear: number;
  endYear: number;
  month?: number;
  day?: number;
  dateApproximate?: boolean;
  /** Source slugs (at least one) */
  sources: string[];
  image?: SeedCardImage;
}

export interface SeedCardLink extends Verifiable {
  from: string;
  to: string;
  type: RelationType;
}

export interface SeedHoliday extends Verifiable {
  slug: string;
  name: string;
  description: string;
  dateType: HolidayDateType;
  month?: number;
  day?: number;
  season?: Season;
  dateNote?: string;
  card?: string;
  source?: string;
}

export interface SeedCulture extends Verifiable {
  slug: string;
  name: string;
  description: string;
  startYear: number;
  endYear: number;
  dateApproximate?: boolean;
  color: string;
  regions: SeedCultureRegion[];
  cards: SeedCard[];
  links: SeedCardLink[];
  holidays: SeedHoliday[];
}

export interface SeedData {
  eras: SeedEra[];
  regions: SeedRegion[];
  sources: SeedSource[];
  cultures: SeedCulture[];
}
