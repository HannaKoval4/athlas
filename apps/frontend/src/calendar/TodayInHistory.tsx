import {
  formatPeriod,
  isSameCalendarDate,
  type TodayCard,
  type TodayHoliday,
  type TodayInHistory as TodayData,
} from '@atlas/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge } from '../components/ui/badge.tsx';
import { formatCalendarDate } from './format.ts';

const COMPACT_COUNT = 3;

/**
 * "Today in history" (F-11): EXACT holidays and dated cards of today, or of the nearest
 * following day when today has none. Recalculated days are marked approximate (BR-15).
 * `compact` is the block of the main screen; the calendar page shows every entry.
 */
export function TodayInHistory({ data, compact = false }: { data: TodayData; compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const entries = [
    ...data.holidays.map((holiday) => ({ kind: 'holiday' as const, holiday })),
    ...data.cards.map((card) => ({ kind: 'card' as const, card })),
  ];
  const shown = compact ? entries.slice(0, COMPACT_COUNT) : entries;
  const today = formatCalendarDate(data.today, i18n.language);

  let caption: string;
  if (!data.date) caption = t('today.nothingDated');
  else if (isSameCalendarDate(data.date, data.today)) caption = today;
  else {
    caption = t('today.nearest', {
      today,
      date: formatCalendarDate(data.date, i18n.language),
    });
  }

  return (
    <section
      aria-labelledby="today-title"
      className="flex flex-col gap-2"
      data-testid="today-in-history"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="today-title"
          className={compact ? 'text-lg font-semibold' : 'text-xl font-semibold'}
        >
          {t('today.title')}
        </h2>
        {compact && (
          <Link to="/calendar" className="text-sm underline underline-offset-2">
            {t('today.toCalendar')}
          </Link>
        )}
      </div>
      <p className="text-sm text-muted-foreground" data-testid="today-caption">
        {caption}
      </p>
      {shown.length > 0 && (
        <ul className={compact ? 'flex flex-col gap-2' : 'grid gap-3 sm:grid-cols-2'}>
          {shown.map((entry) =>
            entry.kind === 'holiday' ? (
              <HolidayEntry key={entry.holiday.id} holiday={entry.holiday} compact={compact} />
            ) : (
              <CardEntry key={entry.card.id} card={entry.card} compact={compact} />
            ),
          )}
        </ul>
      )}
      {compact && entries.length > shown.length && (
        <Link to="/calendar" className="text-xs underline underline-offset-2">
          {t('today.more', { count: entries.length - shown.length })}
        </Link>
      )}
    </section>
  );
}

function ApproximateDay() {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" title={t('today.approximateDayHint')} data-testid="approximate-day">
      {t('today.approximateDay')}
    </Badge>
  );
}

function CultureName({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

function entryClass(compact: boolean) {
  return compact
    ? 'flex flex-col gap-0.5 text-sm'
    : 'flex flex-col gap-1 rounded-lg border bg-card p-3';
}

function CardEntry({ card, compact }: { card: TodayCard; compact: boolean }) {
  const { t } = useTranslation();
  return (
    <li className={entryClass(compact)} data-testid={`today-card-${card.slug}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/cards/${card.slug}`} className="font-medium underline-offset-2 hover:underline">
          {card.title}
        </Link>
        {card.approximateDay && <ApproximateDay />}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <CultureName name={card.culture.name} color={card.culture.color} />
        <span>{t(`cardType.${card.type}`)}</span>
        <span>{formatPeriod(card.startYear, card.endYear)}</span>
      </p>
      {!compact && <p className="text-sm">{card.summary}</p>}
    </li>
  );
}

function HolidayEntry({ holiday, compact }: { holiday: TodayHoliday; compact: boolean }) {
  const { t } = useTranslation();
  return (
    <li className={entryClass(compact)} data-testid={`today-holiday-${holiday.slug}`}>
      <div className="flex flex-wrap items-center gap-2">
        {holiday.cardSlug ? (
          <Link
            to={`/cards/${holiday.cardSlug}`}
            className="font-medium underline-offset-2 hover:underline"
          >
            {holiday.name}
          </Link>
        ) : (
          <span className="font-medium">{holiday.name}</span>
        )}
        <Badge variant="secondary">{t('today.holiday')}</Badge>
        {holiday.approximateDay && <ApproximateDay />}
      </div>
      <p className="text-xs text-muted-foreground">
        <CultureName name={holiday.culture.name} color={holiday.culture.color} />
      </p>
      {!compact && <p className="text-sm">{holiday.description}</p>}
    </li>
  );
}
