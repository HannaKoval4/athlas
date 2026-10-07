import {
  CARD_TYPES,
  type CardType,
  type CultureDetails,
  formatPeriod,
  formatYear,
} from '@atlas/shared';
import { XIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { isApiError } from '../api/client.ts';
import { Badge } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet.tsx';
import { Switch } from '../components/ui/switch.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs.tsx';
import { RandomTopicNote } from '../discover/RandomTopicNote.tsx';
import { NotesPanel } from '../notes/NotesPanel.tsx';
import { useCardList, useCulture } from './content-api.ts';
import { CultureGallery } from './CultureGallery.tsx';
import { CultureGraph } from './CultureGraph.tsx';

type PanelView = 'list' | 'graph';

function isCardType(value: string | null): value is CardType {
  return value !== null && (CARD_TYPES as readonly string[]).includes(value);
}

/**
 * /cultures/:slug — drawer over the map (F-05). The map keeps ?era=&year=; the panel adds
 * ?all=1 (all cards instead of the selected year) and ?type= (active tab), so the view
 * survives a reload and the Back button.
 */
export function CultureSheet() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const location = useLocation();

  const showAll = params.get('all') === '1';
  const view: PanelView = params.get('view') === 'graph' ? 'graph' : 'list';
  const rawYear = Number(params.get('year'));
  const mapYear = Number.isInteger(rawYear) && rawYear !== 0 ? rawYear : null;
  const year = showAll ? null : mapYear;
  const culture = useCulture(slug, year);

  function close() {
    const search = new URLSearchParams();
    for (const key of ['era', 'year']) {
      const value = params.get(key);
      if (value) search.set(key, value);
    }
    void navigate({ pathname: '/', search: search.toString() });
  }

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    // Keep the navigation state (e.g. the random topic reason) while switching tabs and views.
    setParams(next, { replace: true, state: location.state as unknown });
  }

  const data = culture.data;

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl"
        data-testid="culture-sheet"
        aria-describedby={undefined}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-3 right-3"
          onClick={close}
          aria-label={t('culture.close')}
        >
          <XIcon />
        </Button>

        {culture.isPending ? (
          <SheetHeader>
            <SheetTitle>{t('app.loading')}</SheetTitle>
          </SheetHeader>
        ) : culture.isError || !data ? (
          <SheetHeader>
            <SheetTitle>
              {isApiError(culture.error) && culture.error.status === 404
                ? t('culture.notFound')
                : t('culture.loadError')}
            </SheetTitle>
          </SheetHeader>
        ) : (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="flex items-center gap-2 text-xl">
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: data.color }}
                />
                {data.name}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    {t('culture.period')}: {formatPeriod(data.startYear, data.endYear)}
                  </span>
                  {data.dateApproximate && (
                    <Badge variant="outline">{t('culture.approximate')}</Badge>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-6">
              <RandomTopicNote cultureSlug={data.slug} />
              <p className="leading-relaxed">{data.description}</p>

              <CultureGallery cultureId={data.id} year={data.year} />

              <ShowAllSwitch
                checked={showAll}
                disabled={mapYear === null}
                onChange={(checked) => updateParams({ all: checked ? '1' : null })}
              />

              <p className="text-sm text-muted-foreground" data-testid="culture-card-total">
                {data.year === null
                  ? t('culture.cardsTotal', { count: data.totalCards })
                  : t('culture.cardsForYear', {
                      year: formatYear(data.year),
                      count: data.totalCards,
                    })}
              </p>

              <ViewSwitch
                view={view}
                onChange={(next) => updateParams({ view: next === 'graph' ? 'graph' : null })}
              />

              {view === 'graph' ? (
                <CultureGraph slug={data.slug} year={data.year} />
              ) : (
                <CardTabs
                  culture={data}
                  activeType={params.get('type')}
                  onTypeChange={(type) => updateParams({ type })}
                />
              )}

              <div className="border-t pt-4">
                <NotesPanel
                  key={data.id}
                  target={{ cultureId: data.id }}
                  title={t('notes.cultureNotes')}
                />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** "Cards | Link graph" segmented control; the choice is kept in ?view=graph. */
function ViewSwitch({ view, onChange }: { view: PanelView; onChange: (view: PanelView) => void }) {
  const { t } = useTranslation();
  const options: { value: PanelView; label: string }[] = [
    { value: 'list', label: t('culture.viewList') },
    { value: 'graph', label: t('culture.viewGraph') },
  ];
  return (
    <div
      role="group"
      aria-label={t('culture.views')}
      className="flex gap-1 self-start rounded-lg bg-muted p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          data-testid={`view-${option.value}`}
          onClick={() => onChange(option.value)}
          className="rounded-md px-3 py-1 text-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ShowAllSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={checked || disabled}
        disabled={disabled}
        onCheckedChange={onChange}
        data-testid="show-all-switch"
      />
      <label htmlFor={id} className="text-sm">
        {t('culture.showAll')}
      </label>
    </div>
  );
}

function CardTabs({
  culture,
  activeType,
  onTypeChange,
}: {
  culture: CultureDetails;
  activeType: string | null;
  onTypeChange: (type: CardType) => void;
}) {
  const { t } = useTranslation();

  if (culture.totalCards === 0) {
    return (
      <p className="rounded-md bg-muted p-3 text-sm" data-testid="culture-no-cards">
        {culture.year === null
          ? t('culture.noCards')
          : t('culture.noCardsForYear', { year: formatYear(culture.year) })}
      </p>
    );
  }

  // The requested tab if it has cards, otherwise the first non-empty type.
  const available = CARD_TYPES.filter((type) => culture.cardCounts[type] > 0);
  const current =
    isCardType(activeType) && available.includes(activeType) ? activeType : available[0];

  return (
    <Tabs value={current} onValueChange={(value) => isCardType(value) && onTypeChange(value)}>
      <TabsList
        aria-label={t('culture.cardTypesLabel')}
        // A grid instead of one row: seven types do not fit the drawer width. shadcn stretches
        // triggers to the list height, so both the list and the triggers get an automatic height.
        className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 group-data-horizontal/tabs:h-auto"
      >
        {CARD_TYPES.map((type) => (
          <TabsTrigger
            key={type}
            value={type}
            disabled={culture.cardCounts[type] === 0}
            data-testid={`tab-${type}`}
            className="h-auto min-w-0 justify-between px-2 py-1.5 text-left whitespace-normal"
          >
            {t(`cardTypes.${type}`)}
            <span className="text-xs text-muted-foreground">{culture.cardCounts[type]}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={current} className="pt-2">
        <CardList cultureId={culture.id} type={current} year={culture.year} />
      </TabsContent>
    </Tabs>
  );
}

function CardList({
  cultureId,
  type,
  year,
}: {
  cultureId: string;
  type: CardType;
  year: number | null;
}) {
  const { t } = useTranslation();
  const list = useCardList({ cultureId, type, year });
  const cards = list.data?.pages.flatMap((page) => page.items) ?? [];

  if (list.isPending) return <p className="text-sm text-muted-foreground">{t('app.loading')}</p>;
  if (list.isError) return <p role="alert">{t('culture.loadError')}</p>;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2" data-testid="card-list">
        {cards.map((card) => (
          <li key={card.id}>
            <Link
              to={`/cards/${card.slug}`}
              data-testid={`card-link-${card.slug}`}
              className="flex gap-3 rounded-lg border p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              {card.imageUrl && (
                <img
                  src={card.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-16 shrink-0 rounded-md bg-muted object-cover"
                />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {card.title}
                  {!card.published && <Badge variant="secondary">{t('card.draft')}</Badge>}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {formatPeriod(card.startYear, card.endYear)}
                  {card.dateApproximate && ` · ${t('card.approximate')}`}
                </span>
                <span className="mt-1 block text-sm">{card.summary}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => void list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
        >
          {t('culture.loadMore')}
        </Button>
      )}
    </div>
  );
}
