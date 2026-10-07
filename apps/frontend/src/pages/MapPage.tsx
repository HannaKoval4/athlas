import type { MapRegion } from '@atlas/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { useEras, useMapSlice } from '../atlas/api.ts';
import { AtlasMap } from '../atlas/AtlasMap.tsx';
import { EraYearBar } from '../atlas/EraYearBar.tsx';
import { RegionPanel } from '../atlas/RegionPanel.tsx';
import { useSelection } from '../atlas/selection.ts';
import { useTodayInHistory } from '../calendar/api.ts';
import { TodayInHistory } from '../calendar/TodayInHistory.tsx';
import { LoadingScreen } from '../components/LoadingScreen.tsx';
import { useNotes } from '../notes/api.ts';
import { RecentNotes } from '../notes/RecentNotes.tsx';

/**
 * Main screen: era/year tab on top, the map with the time slice; on the side the region
 * panel, the latest notes and "Today in history".
 * Also the parent of /cultures/:slug, so the map stays mounted under the culture drawer.
 */
export function MapPage() {
  const { t } = useTranslation();
  const eras = useEras();
  const { selection, selectEra, selectYear } = useSelection(eras.data);
  const slice = useMapSlice(selection && { era: selection.era.slug, year: selection.year });
  const notes = useNotes({});
  const today = useTodayInHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (eras.isError || slice.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 p-8">
        <p>{t('map.loadError')}</p>
        <button
          type="button"
          onClick={() => void (eras.isError ? eras.refetch() : slice.refetch())}
          className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-100"
        >
          {t('map.retry')}
        </button>
      </div>
    );
  }

  // F-02: only while the first real requests are in flight; later years keep the old map visible.
  // Failed notes or "Today" requests do not block the map: each block shows its own state.
  if (!selection || !slice.data || notes.isPending || today.isPending) {
    return <LoadingScreen label={t('map.loading')} fill="parent" />;
  }

  const regions = slice.data.regions;
  // The selected region disappears when the new year has no materials there.
  const selected: MapRegion | null = regions.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <EraYearBar
        eras={eras.data ?? []}
        selection={selection}
        onEraChange={selectEra}
        onYearChange={selectYear}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* isolate: Leaflet panes use z-index 400+; keep them below drawers and popovers. */}
        <div className="relative isolate min-h-80 flex-1">
          <AtlasMap
            regions={regions}
            selectedId={selected?.id ?? null}
            onSelect={(region) => setSelectedId(region.id)}
          />
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-x-0 top-2 z-[1000] flex justify-center"
          >
            {slice.isPlaceholderData ? (
              <span
                className="rounded bg-white/90 px-3 py-1 text-sm shadow"
                data-testid="map-updating"
              >
                {t('map.updating')}
              </span>
            ) : (
              regions.length === 0 && (
                <span
                  className="rounded bg-white/90 px-3 py-1 text-sm shadow"
                  data-testid="map-empty"
                >
                  {t('map.empty')}
                </span>
              )
            )}
          </div>
        </div>
        <div className="flex flex-col overflow-y-auto border-t border-stone-200 bg-white md:w-80 md:border-t-0 md:border-l">
          <RegionPanel
            year={slice.data.year}
            regions={regions}
            selected={selected}
            onSelect={(region) => setSelectedId(region?.id ?? null)}
          />
          <div className="border-t border-stone-200 p-4">
            {notes.isError ? (
              <p role="alert" className="text-sm">
                {t('notes.loadError')}
              </p>
            ) : (
              <RecentNotes notes={notes.data ?? []} />
            )}
          </div>
          <div className="border-t border-stone-200 p-4">
            {today.isError ? (
              <p role="alert" className="text-sm">
                {t('today.loadError')}
              </p>
            ) : (
              today.data && <TodayInHistory data={today.data} compact />
            )}
          </div>
        </div>
      </div>
      {/* /cultures/:slug renders the culture drawer here, on top of the map. */}
      <Outlet />
    </div>
  );
}
