import type { CardType, RelationType, SourceType } from './enums.js';

/** Response shapes of the public content API, shared with the frontend. */

export interface EraSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  startYear: number;
  endYear: number;
}

export interface MapCulture {
  id: string;
  slug: string;
  name: string;
  /** HEX colour used to highlight the culture's regions */
  color: string;
  /** DM-04: the culture's presence in this region is dated approximately */
  dateApproximate: boolean;
}

/** A GeoJSON geometry as stored in Region.geojson (simplified, borders are conventional). */
export interface RegionGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

export interface MapRegion {
  id: string;
  slug: string;
  name: string;
  geometry: RegionGeometry;
  center: { lat: number; lng: number };
  /** Cultures present in the region in the requested year, ordered by name */
  cultures: MapCulture[];
}

export interface MapSlice {
  year: number;
  regions: MapRegion[];
}

/** Standard paginated list: ?page=1&pageSize=20 -> { items, total, page, pageSize }. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface CultureRef {
  id: string;
  slug: string;
  name: string;
  color: string;
}

export interface CultureSummary extends CultureRef {
  startYear: number;
  endYear: number;
  dateApproximate: boolean;
}

export interface CultureDetails extends CultureSummary {
  description: string;
  /** Year the counts were computed for; null = all cards of the culture */
  year: number | null;
  /** Visible cards per type (every type present, zero included) */
  cardCounts: Record<CardType, number>;
  totalCards: number;
}

export interface CardListItem {
  id: string;
  slug: string;
  type: CardType;
  title: string;
  summary: string;
  startYear: number;
  endYear: number;
  dateApproximate: boolean;
  imageUrl: string | null;
  /** Always true for regular users (BR-06); admins also see drafts */
  published: boolean;
  culture: CultureRef;
}

export interface CardSourceRef {
  id: string;
  type: SourceType;
  title: string;
  author: string | null;
  publisher: string | null;
  year: number | null;
  url: string | null;
  /** Pages cited for this card */
  pages: string | null;
}

/** A link seen from the current card: "outgoing" = this card is CardLink.from (DM-06). */
export interface CardLinkRef {
  direction: 'outgoing' | 'incoming';
  relationType: RelationType;
  card: Pick<CardListItem, 'id' | 'slug' | 'title' | 'type'>;
}

export interface CardDetails extends CardListItem {
  /** Markdown */
  content: string;
  month: number | null;
  day: number | null;
  imageCredit: string | null;
  publishedAt: string | null;
  sources: CardSourceRef[];
  links: CardLinkRef[];
}

/** Cards of a culture and the links between them, for the link graph in the culture panel. */
export interface CultureGraph {
  nodes: Pick<CardListItem, 'id' | 'slug' | 'title' | 'type' | 'imageUrl'>[];
  edges: { fromId: string; toId: string; relationType: RelationType }[];
}
