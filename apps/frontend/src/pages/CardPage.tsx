import { type CardDetails, type CardSourceRef, formatPeriod } from '@atlas/shared';
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { isApiError } from '../api/client.ts';
import { useCard } from '../atlas/content-api.ts';
import { CreditText } from '../atlas/CreditText.tsx';
import { PageContainer } from '../components/AppLayout.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Button } from '../components/ui/button.tsx';
import { NotesPanel } from '../notes/NotesPanel.tsx';

/**
 * /cards/:slug — the card with its period, sources and links in both directions (F-05, F-06)
 * and the user's notes on it in a side column (F-07).
 */
export function CardPage() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const card = useCard(slug);

  return (
    <PageContainer>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="flex min-w-0 flex-col gap-6" data-testid="card-page">
          <BackButton />
          {card.isPending ? (
            <p role="status">{t('app.loading')}</p>
          ) : card.isError ? (
            <div role="alert" className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold">
                {isApiError(card.error) && card.error.status === 404
                  ? t('card.notFound')
                  : t('card.loadError')}
              </h1>
              <Link to="/" className="underline">
                {t('card.toMap')}
              </Link>
            </div>
          ) : (
            <CardBody card={card.data} />
          )}
        </article>
        {card.data && (
          <aside className="self-start lg:sticky lg:top-4">
            {/* key: a new card starts with a closed form. */}
            <NotesPanel
              key={card.data.id}
              target={{ cardId: card.data.id }}
              title={t('notes.cardNotes')}
            />
          </aside>
        )}
      </div>
    </PageContainer>
  );
}

/** Goes back within the app; a card opened from an external link goes to the map instead. */
function BackButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // react-router marks the first entry of the session with key "default".
  const hasHistory = location.key !== 'default';
  return (
    <Button
      variant="ghost"
      size="sm"
      className="self-start"
      onClick={() => void (hasHistory ? navigate(-1) : navigate('/'))}
    >
      <ArrowLeft />
      {t('card.back')}
    </Button>
  );
}

function CardBody({ card }: { card: CardDetails }) {
  const { t } = useTranslation();
  // "Show on the map": the culture panel at the card's first year; the map picks the era.
  const mapLink = `/cultures/${card.culture.slug}?year=${card.startYear}`;

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" data-testid="card-type">
            {t(`cardType.${card.type}`)}
          </Badge>
          {!card.published && <Badge variant="destructive">{t('card.draft')}</Badge>}
        </div>
        <h1 className="text-3xl font-bold" data-testid="card-title">
          {card.title}
        </h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('card.period')}</dt>
          <dd className="flex flex-wrap items-center gap-2" data-testid="card-period">
            {formatPeriod(card.startYear, card.endYear)}
            {card.dateApproximate && (
              <Badge variant="outline" data-testid="card-approximate">
                {t('card.approximate')}
              </Badge>
            )}
          </dd>
          <dt className="text-muted-foreground">{t('card.culture')}</dt>
          <dd className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ backgroundColor: card.culture.color }}
            />
            {card.culture.name}
          </dd>
        </dl>
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link to={mapLink} data-testid="show-on-map">
            <MapPin />
            {t('card.showOnMap')}
          </Link>
        </Button>
      </header>

      <p className="text-lg text-muted-foreground">{card.summary}</p>

      {card.imageUrl && (
        <figure className="flex flex-col gap-1">
          <img
            src={card.imageUrl}
            alt={card.title}
            className="max-h-96 rounded-lg object-contain"
          />
          {card.imageCredit && (
            <figcaption className="text-xs text-muted-foreground">
              {t('card.imageCreditLabel')} <CreditText credit={card.imageCredit} />
            </figcaption>
          )}
        </figure>
      )}

      {/* react-markdown never renders raw HTML, so admin-entered content cannot inject scripts. */}
      <div className="markdown gap-3 leading-relaxed" data-testid="card-content">
        <Markdown>{card.content}</Markdown>
      </div>

      <RelatedCards card={card} />
      <Sources sources={card.sources} />
    </>
  );
}

function RelatedCards({ card }: { card: CardDetails }) {
  const { t } = useTranslation();
  if (card.links.length === 0) return null;

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-2">
      <h2 id="related-title" className="text-xl font-semibold">
        {t('card.related')}
      </h2>
      <ul className="flex flex-col gap-1" data-testid="related-cards">
        {card.links.map((link) => (
          <li key={`${link.direction}-${link.relationType}-${link.card.id}`}>
            <span className="text-sm text-muted-foreground">
              {t(`relation.${link.direction}.${link.relationType}`)}:{' '}
            </span>
            <Link
              to={`/cards/${link.card.slug}`}
              className="font-medium underline underline-offset-2"
              data-testid={`related-${link.card.slug}`}
            >
              {link.card.title}
            </Link>{' '}
            <span className="text-xs text-muted-foreground">
              ({t(`cardType.${link.card.type}`)})
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Short link text; an invalid URL (admin input) is shown as is instead of crashing the page. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Citation: Author. Title. Publisher, Year. Pages. Link. */
function Sources({ sources }: { sources: CardSourceRef[] }) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="sources-title" className="flex flex-col gap-2">
      <h2 id="sources-title" className="text-xl font-semibold">
        {t('card.sources')}
      </h2>
      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('card.noSources')}</p>
      ) : (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm" data-testid="card-sources">
          {sources.map((source) => {
            const imprint = [source.publisher, source.year].filter(Boolean).join(', ');
            return (
              <li key={source.id}>
                {source.author && <>{source.author}. </>}
                <cite>{source.title}</cite>
                {imprint && <>. {imprint}</>}
                {source.pages && <>. {t('card.pages', { pages: source.pages })}</>}
                {source.url && (
                  <>
                    {' '}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 underline"
                    >
                      {hostOf(source.url)}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
