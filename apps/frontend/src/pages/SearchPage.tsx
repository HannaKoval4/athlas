import {
  CARD_TYPES,
  type CardSearchHit,
  type CardType,
  type CultureSearchHit,
  type HolidaySearchHit,
  type SearchQuery,
  SEARCH_QUERY_MAX_LENGTH,
  formatPeriod,
  splitHighlights,
} from '@atlas/shared';
import { MapPin } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useEras } from '../atlas/api.ts';
import { holidayDateLabel } from '../calendar/format.ts';
import { PageContainer } from '../components/AppLayout.tsx';
import { Field, Select, TextInput } from '../components/form.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import { useCultures, useRegions, useSearch } from '../search/api.ts';

const PAGE_SIZE = 20;
const TYPING_DELAY_MS = 300;
const CUSTOM_PERIOD = 'custom';

function isCardType(value: string | null): value is CardType {
  return value !== null && (CARD_TYPES as readonly string[]).includes(value);
}

/** A year typed into a filter: an integer other than 0 (there is no year 0), else nothing. */
function parseYear(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const year = Number(value);
  return Number.isInteger(year) && year !== 0 ? year : undefined;
}

/**
 * /search (F-09). Every criterion lives in the URL (?q=&type=&culture=&region=&era=&from=&to=
 * &page=), so a search can be bookmarked and Back returns to the previous one. The period
 * is an era (its bounds) or a custom range.
 */
export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const eras = useEras();
  const cultures = useCultures();
  const regions = useRegions();

  const urlQuery = params.get('q') ?? '';
  const rawType = params.get('type');
  const type = isCardType(rawType) ? rawType : undefined;
  const cultureId = params.get('culture') ?? undefined;
  const regionId = params.get('region') ?? undefined;
  const period = params.get('era') ?? '';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  let yearFrom: number | undefined;
  let yearTo: number | undefined;
  if (period === CUSTOM_PERIOD) {
    yearFrom = parseYear(params.get('from'));
    yearTo = parseYear(params.get('to'));
  } else {
    const era = eras.data?.find((e) => e.slug === period);
    yearFrom = era?.startYear;
    yearTo = era?.endYear;
  }
  const invalidRange = yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo;

  const hasCriteria =
    urlQuery.trim() !== '' ||
    type !== undefined ||
    cultureId !== undefined ||
    regionId !== undefined ||
    yearFrom !== undefined ||
    yearTo !== undefined;
  const query: SearchQuery | null =
    hasCriteria && !invalidRange
      ? { q: urlQuery, type, cultureId, regionId, yearFrom, yearTo, page, pageSize: PAGE_SIZE }
      : null;
  const results = useSearch(query);

  /** Changes URL parameters; any new criterion starts again from the first page. */
  function update(changes: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  // The text box updates the URL after a short pause in typing, not on every key.
  const [text, setText] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  const [sentQuery, setSentQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    // Changed from outside (Back button, link, reset): show it in the box. Our own update
    // is skipped, so letters typed while it was on its way are kept.
    if (urlQuery !== sentQuery) setText(urlQuery);
  }
  function sendQuery(value: string) {
    setSentQuery(value);
    update({ q: value });
  }
  useEffect(() => {
    if (text.trim() === urlQuery) return;
    const timer = setTimeout(() => sendQuery(text.trim()), TYPING_DELAY_MS);
    return () => clearTimeout(timer);
    // `sendQuery` is recreated on every render; only typing should restart the pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, urlQuery]);

  function submit(event: FormEvent) {
    event.preventDefault();
    sendQuery(text.trim());
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6" data-testid="search-page">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{t('search.title')}</h1>
          <p className="text-muted-foreground">{t('search.intro')}</p>
        </header>

        <form role="search" onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t('search.queryLabel')}>
            {({ id }) => (
              <TextInput
                id={id}
                type="search"
                value={text}
                maxLength={SEARCH_QUERY_MAX_LENGTH}
                placeholder={t('search.queryPlaceholder')}
                autoComplete="off"
                data-testid="search-input"
                onChange={(event) => setText(event.target.value)}
              />
            )}
          </Field>

          <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <legend className="sr-only">{t('search.filters')}</legend>
            <Field label={t('search.type')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={type ?? ''}
                  data-testid="filter-type"
                  onChange={(event) => update({ type: event.target.value })}
                >
                  <option value="">{t('search.anyType')}</option>
                  {CARD_TYPES.map((cardType) => (
                    <option key={cardType} value={cardType}>
                      {t(`cardType.${cardType}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('search.culture')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={cultureId ?? ''}
                  data-testid="filter-culture"
                  onChange={(event) => update({ culture: event.target.value })}
                >
                  <option value="">{t('search.anyCulture')}</option>
                  {cultures.data?.map((culture) => (
                    <option key={culture.id} value={culture.id}>
                      {culture.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('search.region')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={regionId ?? ''}
                  data-testid="filter-region"
                  onChange={(event) => update({ region: event.target.value })}
                >
                  <option value="">{t('search.anyRegion')}</option>
                  {regions.data?.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('search.period')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={period}
                  data-testid="filter-period"
                  onChange={(event) => update({ era: event.target.value, from: null, to: null })}
                >
                  <option value="">{t('search.anyTime')}</option>
                  {eras.data?.map((era) => (
                    <option key={era.id} value={era.slug}>
                      {era.name} ({formatPeriod(era.startYear, era.endYear)})
                    </option>
                  ))}
                  <option value={CUSTOM_PERIOD}>{t('search.customPeriod')}</option>
                </Select>
              )}
            </Field>
          </fieldset>

          {period === CUSTOM_PERIOD && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <YearInput
                label={t('search.yearFrom')}
                value={params.get('from') ?? ''}
                testId="filter-year-from"
                onChange={(value) => update({ from: value })}
              />
              <YearInput
                label={t('search.yearTo')}
                value={params.get('to') ?? ''}
                testId="filter-year-to"
                error={invalidRange ? t('search.yearRangeInvalid') : undefined}
                onChange={(value) => update({ to: value })}
              />
            </div>
          )}

          {hasCriteria && (
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={() => {
                setText('');
                setParams({}, { replace: true });
              }}
            >
              {t('search.reset')}
            </Button>
          )}
        </form>

        <div aria-live="polite" className="text-sm text-muted-foreground">
          {results.isFetching && results.isPlaceholderData && t('search.updating')}
        </div>

        {!query ? (
          !invalidRange && <p data-testid="search-prompt">{t('search.prompt')}</p>
        ) : results.isError ? (
          <p role="alert">{t('search.loadError')}</p>
        ) : !results.data ? (
          <p role="status">{t('app.loading')}</p>
        ) : (
          <Results
            results={results.data}
            onPage={(next) => update({ page: next === 1 ? null : String(next) })}
          />
        )}
      </div>
    </PageContainer>
  );
}

function YearInput(props: {
  label: string;
  value: string;
  testId: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field label={props.label} hint={t('search.yearHint')} error={props.error}>
      {({ id, describedBy, invalid }) => (
        <TextInput
          id={id}
          type="number"
          step={1}
          value={props.value}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          data-testid={props.testId}
          onChange={(event) => props.onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function Results({
  results,
  onPage,
}: {
  results: NonNullable<ReturnType<typeof useSearch>['data']>;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const { cards, cultures, holidays } = results;
  const pages = Math.max(1, Math.ceil(cards.total / cards.pageSize));

  if (cards.total === 0 && cultures.length === 0 && holidays.length === 0) {
    return <p data-testid="search-nothing">{t('search.nothing')}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {cultures.length > 0 && (
        <ResultGroup title={t('search.cultures')} testId="results-cultures">
          {cultures.map((culture) => (
            <CultureResult key={culture.id} culture={culture} />
          ))}
        </ResultGroup>
      )}
      <ResultGroup
        title={t('search.cards')}
        testId="results-cards"
        subtitle={t('search.total', { count: cards.total })}
      >
        {cards.items.map((card) => (
          <CardResult key={card.id} card={card} />
        ))}
      </ResultGroup>
      {pages > 1 && (
        <nav aria-label={t('search.cards')} className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={cards.page <= 1}
            onClick={() => onPage(cards.page - 1)}
          >
            {t('search.prev')}
          </Button>
          <span className="text-sm" data-testid="search-page-number">
            {t('search.page', { page: cards.page, pages })}
          </span>
          <Button
            variant="outline"
            disabled={cards.page >= pages}
            data-testid="search-next-page"
            onClick={() => onPage(cards.page + 1)}
          >
            {t('search.next')}
          </Button>
        </nav>
      )}
      {holidays.length > 0 && (
        <ResultGroup title={t('search.holidays')} testId="results-holidays">
          {holidays.map((holiday) => (
            <HolidayResult key={holiday.id} holiday={holiday} />
          ))}
        </ResultGroup>
      )}
    </div>
  );
}

function ResultGroup(props: {
  title: string;
  subtitle?: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={props.title} className="flex flex-col gap-3" data-testid={props.testId}>
      <div className="flex items-baseline gap-3 border-b pb-1">
        <h2 className="text-xl font-semibold">{props.title}</h2>
        {props.subtitle && (
          <span className="text-sm text-muted-foreground" data-testid="search-total">
            {props.subtitle}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-3">{props.children}</ul>
    </section>
  );
}

/** The fragment around the found words; Markdown symbols of the source text are dropped. */
function Snippet({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {splitHighlights(text.replace(/[*_#>`]+/g, '')).map((part, index) =>
        part.highlighted ? (
          <mark key={index} className="rounded-sm bg-amber-200 px-0.5 text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function CardResult({ card }: { card: CardSearchHit }) {
  const { t } = useTranslation();
  return (
    <li
      className="flex gap-3 rounded-lg border bg-card p-3"
      data-testid={`result-card-${card.slug}`}
    >
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt=""
          loading="lazy"
          className="size-16 shrink-0 rounded-md bg-muted object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/cards/${card.slug}`}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {card.title}
          </Link>
          <Badge variant="secondary">{t(`cardType.${card.type}`)}</Badge>
          {!card.published && <Badge variant="destructive">{t('card.draft')}</Badge>}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: card.culture.color }}
            />
            {card.culture.name}
          </span>
          <span>
            {formatPeriod(card.startYear, card.endYear)}
            {card.dateApproximate && ` · ${t('card.approximate')}`}
          </span>
        </p>
        {card.snippet ? <Snippet text={card.snippet} /> : <p className="text-sm">{card.summary}</p>}
        <Link
          to={`/cultures/${card.culture.slug}?year=${card.startYear}`}
          className="flex items-center gap-1 self-start text-xs underline underline-offset-2"
        >
          <MapPin className="size-3" aria-hidden="true" />
          {t('search.showOnMap')}
        </Link>
      </div>
    </li>
  );
}

function CultureResult({ culture }: { culture: CultureSearchHit }) {
  const { t } = useTranslation();
  return (
    <li
      className="flex flex-col gap-1 rounded-lg border bg-card p-3"
      data-testid={`result-culture-${culture.slug}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className="size-3 rounded-full"
          style={{ backgroundColor: culture.color }}
        />
        <Link to={`/cultures/${culture.slug}`} className="font-semibold hover:underline">
          {culture.name}
        </Link>
        <span className="text-xs text-muted-foreground">
          {formatPeriod(culture.startYear, culture.endYear)}
          {culture.dateApproximate && ` · ${t('culture.approximate')}`}
        </span>
      </div>
      <Snippet text={culture.snippet} />
    </li>
  );
}

function HolidayResult({ holiday }: { holiday: HolidaySearchHit }) {
  const { t, i18n } = useTranslation();
  const date = holidayDateLabel(holiday, t, i18n.language);

  return (
    <li
      className="flex flex-col gap-1 rounded-lg border bg-card p-3"
      data-testid={`result-holiday-${holiday.slug}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{holiday.name}</span>
        <Badge variant="outline">{date}</Badge>
        <span className="text-xs text-muted-foreground">{holiday.culture.name}</span>
      </div>
      <Snippet text={holiday.snippet} />
      {holiday.cardSlug && (
        <Link
          to={`/cards/${holiday.cardSlug}`}
          className="self-start text-xs underline underline-offset-2"
        >
          {t('search.toCard')}
        </Link>
      )}
    </li>
  );
}
