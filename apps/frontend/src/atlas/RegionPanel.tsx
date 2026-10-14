import { type MapRegion } from '@atlas/shared';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useYearFormat } from '../i18n/use-year-format.ts';

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
  const { formatYear } = useYearFormat();
  // The culture drawer keeps the map's ?era=&year= so closing it returns to the same view.
  const [params] = useSearchParams();

  return (
    <aside aria-labelledby="region-panel-title" className="flex flex-col gap-4 p-4">
      <div>
        <h2 id="region-panel-title" className="text-lg font-semibold">
          {t('map.regionsTitle')}
        </h2>
        <p className="text-sm text-muted-foreground" data-testid="regions-count">
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
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-400 aria-pressed:bg-amber-100 dark:aria-pressed:bg-amber-900/40 aria-pressed:font-semibold"
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
              className="text-sm text-amber-900 dark:text-amber-200 underline focus-visible:outline-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-400"
            >
              {t('map.closeRegion')}
            </button>
          </div>
          <p className="mb-2 text-sm text-muted-foreground">
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
                <Link
                  to={{ pathname: `/cultures/${culture.slug}`, search: params.toString() }}
                  className="font-medium text-amber-900 dark:text-amber-200 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-400"
                >
                  {culture.name}
                </Link>
                {culture.dateApproximate && (
                  <span className="text-xs text-muted-foreground">({t('map.approximate')})</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        regions.length > 0 && (
          <p className="text-sm text-muted-foreground">{t('map.selectRegionHint')}</p>
        )
      )}
    </aside>
  );
}
