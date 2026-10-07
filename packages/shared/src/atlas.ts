/** Response shapes of the public content API (eras, map), shared with the frontend. */

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
