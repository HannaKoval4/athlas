import { type MapRegion, formatYear } from '@atlas/shared';
import { useTranslation } from 'react-i18next';

interface RegionPanelProps {
  year: number;
  regions: MapRegion[];
  selected: MapRegion | null;
  onSelect: (region: MapRegion | null) => void;
}

/**
 * Side panel of the map. The region list duplicates the polygons for keyboard and
 * screen-reader users (map shapes are not focusable); a chosen region shows its cultures.
 */
export function RegionPanel({ year, regions, selected, onSelect }: RegionPanelProps) {
  const { t } = useTranslation();

  return (
    <aside
      aria-labelledby="region-panel-title"
      className="flex flex-col gap-4 overflow-y-auto border-t border-stone-200 bg-white p-4 md:w-80 md:border-t-0 md:border-l"
    >
      <div>
        <h2 id="region-panel-title" className="text-lg font-semibold">
          {t('map.regionsTitle')}
        </h2>
        <p className="text-sm text-stone-600" data-testid="regions-count">
          {t('map.regionsCount', { count: regions.length })}
        </p>
      </div>

      {regions.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="region-list">
          {regions.map((region) => (
            <li key={region.id}>
              <button
                type="button"
                aria-pressed={region.id === selected?.id}
                data-testid={`region-${region.slug}`}
                onClick={() => onSelect(region.id === selected?.id ? null : region)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-amber-700 aria-pressed:bg-amber-100 aria-pressed:font-semibold"
              >
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: region.cultures[0]?.color }}
                />
                {region.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <section data-testid="region-details" aria-labelledby="region-details-title">
          <div className="flex items-start justify-between gap-2">
            <h3 id="region-details-title" className="font-semibold">
              {selected.name}
            </h3>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-sm text-amber-900 underline focus-visible:outline-2 focus-visible:outline-amber-700"
            >
              {t('map.closeRegion')}
            </button>
          </div>
          <p className="mb-2 text-sm text-stone-600">
            {t('map.culturesIn', { year: formatYear(year) })}
          </p>
          <ul className="flex flex-col gap-2">
            {selected.cultures.map((culture) => (
              <li
                key={culture.id}
                data-testid={`culture-${culture.slug}`}
                className="flex items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: culture.color }}
                />
                <span>{culture.name}</span>
                {culture.dateApproximate && (
                  <span className="text-xs text-stone-600">({t('map.approximate')})</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        regions.length > 0 && <p className="text-sm text-stone-600">{t('map.selectRegionHint')}</p>
      )}
    </aside>
  );
}
