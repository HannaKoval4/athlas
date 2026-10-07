import type { MapRegion } from '@atlas/shared';
import type { PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { GeoJSON, type GeoJSONProps, MapContainer, TileLayer, Tooltip } from 'react-leaflet';

/** OpenStreetMap tiles by default; VITE_MAP_TILE_URL can point to another tile server. */
const TILE_URL =
  (import.meta.env.VITE_MAP_TILE_URL as string | undefined) ??
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** The MVP cultures are around the Mediterranean; the user can pan and zoom anywhere. */
const INITIAL_CENTER: [number, number] = [36, 22];
const INITIAL_ZOOM = 4;

interface AtlasMapProps {
  regions: MapRegion[];
  selectedId: string | null;
  onSelect: (region: MapRegion) => void;
}

function regionStyle(region: MapRegion, selected: boolean): PathOptions {
  // A region shared by several cultures takes the colour of the first one (ordered by name).
  const color = region.cultures[0]?.color ?? '#78716c';
  return {
    color,
    weight: selected ? 4 : 2,
    fillColor: color,
    fillOpacity: selected ? 0.55 : 0.35,
    // Stable hook for UI tests and styling: <path class="atlas-region region-crete">.
    className: `atlas-region region-${region.slug}`,
  };
}

export function AtlasMap({ regions, selectedId, onSelect }: AtlasMapProps) {
  const { t } = useTranslation();

  return (
    <div className="relative h-full min-h-80" data-testid="atlas-map">
      <MapContainer
        center={INITIAL_CENTER}
        zoom={INITIAL_ZOOM}
        minZoom={2}
        worldCopyJump
        className="h-full w-full"
        aria-label={t('map.label')}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {regions.map((region) => (
          <GeoJSON
            // react-leaflet does not update `data` in place; a region's geometry never changes
            // between slices, so the region id is a sufficient key.
            key={region.id}
            data={
              { type: 'Feature', properties: {}, geometry: region.geometry } as GeoJSONProps['data']
            }
            style={regionStyle(region, region.id === selectedId)}
            eventHandlers={{ click: () => onSelect(region) }}
          >
            <Tooltip sticky>{region.name}</Tooltip>
          </GeoJSON>
        ))}
      </MapContainer>
      <p className="pointer-events-none absolute bottom-6 left-2 z-[1000] rounded bg-white/85 px-2 py-0.5 text-xs text-stone-700">
        {t('map.bordersNote')}
      </p>
    </div>
  );
}
