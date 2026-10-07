import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SeedCulture, SeedData, SeedEra, SeedRegion, SeedSource } from './types';

export const SEED_DATA_DIR = __dirname;

/** Culture files in load order (fallback plan: Egypt and Greece first). */
export const CULTURE_FILES = ['egypt.json', 'greece.json'];

interface RegionFeature {
  type: 'Feature';
  properties: Omit<SeedRegion, 'geometry'>;
  geometry: SeedRegion['geometry'];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadSeedData(dir: string = SEED_DATA_DIR): SeedData {
  const regionsDir = join(dir, 'regions');
  const regions = readdirSync(regionsDir)
    .filter((file) => file.endsWith('.geojson'))
    .sort()
    .map((file) => {
      const feature = readJson<RegionFeature>(join(regionsDir, file));
      return { ...feature.properties, geometry: feature.geometry };
    });

  return {
    eras: readJson<SeedEra[]>(join(dir, 'eras.json')),
    regions,
    sources: readJson<SeedSource[]>(join(dir, 'sources.json')),
    cultures: CULTURE_FILES.map((file) => readJson<SeedCulture>(join(dir, file))),
  };
}
