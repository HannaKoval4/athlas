import { FEED_DEFAULT_LIMIT, type FeedCard, formatPeriod } from '@atlas/shared';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageContainer } from '../components/AppLayout.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { useFeed } from '../discover/api.ts';

/** /new: the latest published materials of the atlas (F-13), not world news. */
export function NewPage() {
  const { t } = useTranslation();
  const feed = useFeed(FEED_DEFAULT_LIMIT);

  return (
    <PageContainer>
      <div className="flex flex-col gap-6" data-testid="new-page">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{t('feed.title')}</h1>
          <p className="text-muted-foreground">{t('feed.intro')}</p>
        </header>
        {feed.isError ? (
          <p role="alert">{t('feed.loadError')}</p>
        ) : !feed.data ? (
          <p role="status">{t('app.loading')}</p>
        ) : feed.data.length === 0 ? (
          <p>{t('feed.empty')}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {feed.data.map((card) => (
              <FeedItem key={card.id} card={card} />
            ))}
          </ol>
        )}
      </div>
    </PageContainer>
  );
}

function FeedItem({ card }: { card: FeedCard }) {
  const { t, i18n } = useTranslation();
  return (
    <li className="flex gap-3 rounded-lg border bg-card p-3" data-testid={`feed-card-${card.slug}`}>
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt=""
          loading="lazy"
          className="size-20 shrink-0 rounded-md bg-muted object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <time dateTime={card.publishedAt} className="text-xs text-muted-foreground">
          {t('feed.published', {
            date: new Date(card.publishedAt).toLocaleDateString(i18n.language, {
              dateStyle: 'long',
            }),
          })}
        </time>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/cards/${card.slug}`}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {card.title}
          </Link>
          <Badge variant="secondary">{t(`cardType.${card.type}`)}</Badge>
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
        <p className="text-sm">{card.summary}</p>
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
