import { type Holiday, HolidayDateType } from '@atlas/shared';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { useHolidays, useTodayInHistory } from '../calendar/api.ts';
import { formatMonth, holidayDateLabel } from '../calendar/format.ts';
import { TodayInHistory } from '../calendar/TodayInHistory.tsx';
import { PageContainer } from '../components/AppLayout.tsx';
import { Field, Select } from '../components/form.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { useCultures } from '../search/api.ts';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const DATE_TYPES = Object.values(HolidayDateType);

function parseMonth(value: string | null): number | undefined {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined;
}

/**
 * /calendar: "Today in history" (F-11) and the holiday calendar (F-10). Holidays are grouped
 * by how exactly their date is known; every date that is not exact is explained.
 * Filters live in the URL (?culture=&month=).
 */
export function CalendarPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const cultures = useCultures();
  const today = useTodayInHistory();

  const cultureId = params.get('culture') ?? undefined;
  const month = parseMonth(params.get('month'));
  const holidays = useHolidays({ cultureId, month });

  function update(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-8" data-testid="calendar-page">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{t('calendar.title')}</h1>
          <p className="text-muted-foreground">{t('calendar.intro')}</p>
        </header>

        {today.isError ? (
          <p role="alert">{t('today.loadError')}</p>
        ) : today.data ? (
          <TodayInHistory data={today.data} />
        ) : (
          <p role="status">{t('app.loading')}</p>
        )}

        <section aria-labelledby="holidays-title" className="flex flex-col gap-4">
          <h2 id="holidays-title" className="border-b pb-1 text-xl font-semibold">
            {t('calendar.holidays')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('calendar.culture')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={cultureId ?? ''}
                  data-testid="calendar-culture"
                  onChange={(event) => update('culture', event.target.value)}
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
            <Field label={t('calendar.month')}>
              {({ id }) => (
                <Select
                  id={id}
                  value={month ?? ''}
                  data-testid="calendar-month"
                  onChange={(event) => update('month', event.target.value)}
                >
                  <option value="">{t('calendar.anyMonth')}</option>
                  {MONTHS.map((value) => (
                    <option key={value} value={value}>
                      {formatMonth(value, i18n.language)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {month !== undefined && (
            <p className="text-sm text-muted-foreground" data-testid="calendar-month-hint">
              {t('calendar.monthHint')}
            </p>
          )}

          {holidays.isError ? (
            <p role="alert">{t('calendar.loadError')}</p>
          ) : !holidays.data ? (
            <p role="status">{t('app.loading')}</p>
          ) : holidays.data.length === 0 ? (
            <p data-testid="calendar-empty">{t('calendar.empty')}</p>
          ) : (
            DATE_TYPES.map((dateType) => {
              const group = holidays.data.filter((holiday) => holiday.dateType === dateType);
              return (
                group.length > 0 && (
                  <HolidayGroup key={dateType} dateType={dateType} holidays={group} />
                )
              );
            })
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function HolidayGroup({ dateType, holidays }: { dateType: HolidayDateType; holidays: Holiday[] }) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby={`holidays-${dateType}`}
      className="flex flex-col gap-3"
      data-testid={`holiday-group-${dateType}`}
    >
      <div>
        <h3 id={`holidays-${dateType}`} className="text-lg font-semibold">
          {t(`calendar.groups.${dateType}`)}
        </h3>
        <p className="text-sm text-muted-foreground">{t(`calendar.groupHints.${dateType}`)}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {holidays.map((holiday) => (
          <HolidayItem key={holiday.id} holiday={holiday} />
        ))}
      </ul>
    </section>
  );
}

function HolidayItem({ holiday }: { holiday: Holiday }) {
  const { t, i18n } = useTranslation();
  return (
    <li
      className="flex flex-col gap-2 rounded-lg border bg-card p-3"
      data-testid={`holiday-${holiday.slug}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{holiday.name}</span>
        <Badge variant="outline">{holidayDateLabel(holiday, t, i18n.language)}</Badge>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: holiday.culture.color }}
          />
          {holiday.culture.name}
        </span>
      </div>
      <p className="text-sm">{holiday.description}</p>
      {holiday.dateNote && (
        <p
          className="flex gap-2 rounded-md bg-muted p-2 text-sm text-muted-foreground"
          data-testid="holiday-date-note"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">{t('calendar.dateNote')}</span> {holiday.dateNote}
          </span>
        </p>
      )}
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
