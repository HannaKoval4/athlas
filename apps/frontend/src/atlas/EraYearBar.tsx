import {
  type EraSummary,
  formatYear,
  isYearInPeriod,
  ordinalToYear,
  yearToOrdinal,
} from '@atlas/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Selection } from './selection.ts';

/** Slider moves are applied after a short pause, so dragging does not fire a request per step. */
const COMMIT_DELAY_MS = 300;

interface EraYearBarProps {
  eras: EraSummary[];
  selection: Selection;
  onEraChange: (era: EraSummary) => void;
  onYearChange: (year: number) => void;
}

/** The "tab" at the top of the map: era buttons, a year slider and an exact year input (F-04). */
export function EraYearBar({ eras, selection, onEraChange, onYearChange }: EraYearBarProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const panelId = useId();
  const { era, year } = selection;

  // Draft year follows the slider immediately; the URL (and the map) follow after a pause.
  // When the URL changes from outside (Back button, era switch), the draft is reset to it.
  const [draft, setDraft] = useState(year);
  const [syncedYear, setSyncedYear] = useState(year);
  if (year !== syncedYear) {
    setSyncedYear(year);
    setDraft(year);
  }

  useEffect(() => {
    if (draft === year) return;
    const timer = setTimeout(() => onYearChange(draft), COMMIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, year, onYearChange]);

  return (
    <section
      aria-label={t('era.barLabel')}
      data-testid="era-bar"
      className="border-b border-stone-200 bg-amber-50/95"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        title={t('era.toggle')}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-700"
      >
        <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
        <span data-testid="selection-summary">
          {era.name} · {formatYear(draft)}
        </span>
      </button>

      <div id={panelId} hidden={!expanded} className="px-4 pb-3">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <div role="group" aria-label={t('era.eras')} className="flex flex-wrap gap-2">
            {eras.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === era.id}
                data-testid={`era-${item.slug}`}
                onClick={() => onEraChange(item)}
                className="rounded-full border border-amber-800/40 px-3 py-1 text-sm hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-700 aria-pressed:bg-amber-800 aria-pressed:text-white"
              >
                {item.name}
              </button>
            ))}
          </div>

          <YearSlider era={era} year={draft} onChange={setDraft} />
          <YearInput era={era} year={draft} onSubmit={setDraft} />
          <p className="text-xs text-stone-600">{t('era.boundsNote')}</p>
        </div>
      </div>
    </section>
  );
}

/** The range input works on gap-free ordinals: dragging from 1 BCE goes straight to 1 CE. */
function YearSlider({
  era,
  year,
  onChange,
}: {
  era: EraSummary;
  year: number;
  onChange: (year: number) => void;
}) {
  const { t } = useTranslation();
  const start = formatYear(era.startYear);
  const end = formatYear(era.endYear);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden w-32 text-right text-stone-600 sm:block">{start}</span>
      <input
        type="range"
        data-testid="year-slider"
        aria-label={t('era.yearSlider')}
        aria-valuetext={formatYear(year)}
        min={yearToOrdinal(era.startYear)}
        max={yearToOrdinal(era.endYear)}
        step={1}
        value={yearToOrdinal(year)}
        onChange={(event) => onChange(ordinalToYear(Number(event.target.value)))}
        className="h-2 flex-1 cursor-pointer accent-amber-800"
      />
      <span className="hidden w-32 text-stone-600 sm:block">{end}</span>
    </div>
  );
}

function YearInput({
  era,
  year,
  onSubmit,
}: {
  era: EraSummary;
  year: number;
  onSubmit: (year: number) => void;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const messageId = useId();
  const [text, setText] = useState(String(year));
  const [error, setError] = useState<string | null>(null);

  // Keep the field in step with the slider.
  const [syncedYear, setSyncedYear] = useState(year);
  if (year !== syncedYear) {
    setSyncedYear(year);
    setText(String(year));
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    // Accept the typographic minus as well: "−450".
    const normalized = text.trim().replace('−', '-');
    const value = /^-?\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
    if (!Number.isInteger(value) || value === 0) {
      setError(t('era.yearInvalid'));
      return;
    }
    if (!isYearInPeriod(value, era.startYear, era.endYear)) {
      setError(
        t('era.yearOutOfEra', { from: formatYear(era.startYear), to: formatYear(era.endYear) }),
      );
      return;
    }
    setError(null);
    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor={inputId}>{t('era.yearInput')}</label>
      <input
        id={inputId}
        data-testid="year-input"
        inputMode="numeric"
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-invalid={error !== null}
        aria-describedby={messageId}
        className="w-28 rounded border border-stone-300 bg-white px-2 py-1 aria-invalid:border-red-700"
      />
      <button
        type="submit"
        data-testid="year-submit"
        className="rounded border border-stone-300 bg-white px-3 py-1 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-amber-700"
      >
        {t('era.go')}
      </button>
      <strong data-testid="year-display" className="ml-2">
        {formatYear(year)}
      </strong>
      <span
        id={messageId}
        role={error ? 'alert' : undefined}
        className={error ? 'text-red-700' : 'text-stone-600'}
      >
        {error ?? t('era.yearInputHint')}
      </span>
    </form>
  );
}
