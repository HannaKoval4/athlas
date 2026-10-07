import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useViewHistory } from './api.ts';

/** Profile section: the latest viewed cards (BR-20). */
export function ViewHistory() {
  const { t, i18n } = useTranslation();
  const history = useViewHistory();

  return (
    <section aria-labelledby="view-history" className="flex flex-col gap-2">
      <h2 id="view-history" className="text-xl font-semibold">
        {t('history.title')}
      </h2>
      {history.isError ? (
        <p role="alert">{t('history.loadError')}</p>
      ) : !history.data ? (
        <p role="status">{t('app.loading')}</p>
      ) : history.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
      ) : (
        <ol className="flex flex-col gap-1" data-testid="view-history">
          {history.data.map((card) => (
            <li key={card.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <Link to={`/cards/${card.slug}`} className="underline underline-offset-2">
                {card.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {card.culture.name} ·{' '}
                {new Date(card.viewedAt).toLocaleString(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
