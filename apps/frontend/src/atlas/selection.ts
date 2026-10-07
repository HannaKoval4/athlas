import { type EraSummary, clampYear, isValidYear, isYearInPeriod, middleYear } from '@atlas/shared';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export interface Selection {
  era: EraSummary;
  year: number;
}

function parseYear(raw: string | null): number | null {
  if (raw === null || !/^-?\d+$/.test(raw)) return null;
  const year = Number(raw);
  return isValidYear(year) ? year : null;
}

/**
 * Turns ?era=&year= into a valid selection, whatever the URL says:
 * unknown era -> the era containing the year, else the first era;
 * missing year -> middle of the era; year outside the era -> clamped to it (BR-05).
 */
export function resolveSelection(
  eras: EraSummary[],
  eraSlug: string | null,
  rawYear: string | null,
): Selection | null {
  if (eras.length === 0) return null;
  const year = parseYear(rawYear);
  const era =
    eras.find((e) => e.slug === eraSlug) ??
    (year === null ? undefined : eras.find((e) => isYearInPeriod(year, e.startYear, e.endYear))) ??
    eras[0];

  if (year === null) return { era, year: middleYear(era.startYear, era.endYear) };
  return { era, year: clampYear(year, era.startYear, era.endYear) };
}

/** The era and year live in the URL, so a link reopens the same view and "Back" works. */
export function useSelection(eras: EraSummary[] | undefined) {
  const [params, setParams] = useSearchParams();
  const eraParam = params.get('era');
  const yearParam = params.get('year');

  const selection = useMemo(
    () => (eras ? resolveSelection(eras, eraParam, yearParam) : null),
    [eras, eraParam, yearParam],
  );

  // Normalise an invalid or partial URL in place (no extra history entry). Other parameters
  // (e.g. the culture drawer's ?all=&type=) are kept.
  useEffect(() => {
    if (!selection) return;
    const year = String(selection.year);
    if (eraParam !== selection.era.slug || yearParam !== year) {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('era', selection.era.slug);
          next.set('year', year);
          return next;
        },
        { replace: true },
      );
    }
  }, [selection, eraParam, yearParam, setParams]);

  const select = useCallback(
    (era: EraSummary, year: number) => setParams({ era: era.slug, year: String(year) }),
    [setParams],
  );

  /** Switching the era keeps the year when it fits, otherwise jumps to the era's middle. */
  const selectEra = useCallback(
    (era: EraSummary) => {
      const year =
        selection && isYearInPeriod(selection.year, era.startYear, era.endYear)
          ? selection.year
          : middleYear(era.startYear, era.endYear);
      select(era, year);
    },
    [select, selection],
  );

  const selectYear = useCallback(
    (year: number) => {
      if (selection) select(selection.era, year);
    },
    [select, selection],
  );

  return { selection, selectEra, selectYear };
}
