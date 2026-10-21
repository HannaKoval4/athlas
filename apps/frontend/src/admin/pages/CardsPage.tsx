import { CARD_TYPES, type CardType } from '@atlas/shared';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Select, TextInput } from '../../components/form.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/button.tsx';
import { useYearFormat } from '../../i18n/use-year-format.ts';
import { useAdminCards, useSetPublished } from '../api.ts';
import { AdminTable, LoadState, NamedOptions, SectionHeader } from '../components.tsx';
import { useCultureOptions } from '../hooks.ts';

const PAGE_SIZE = 20;

/** All cards, drafts included, newest edits first; filters live in the URL. */
export function CardsPage() {
  const { t } = useTranslation();
  const { formatPeriod } = useYearFormat();
  const [params, setParams] = useSearchParams();
  const cultures = useCultureOptions();
  const publish = useSetPublished();

  const q = params.get('q') ?? '';
  const cultureId = params.get('cultureId') ?? '';
  const type = (params.get('type') ?? '') as CardType | '';
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;

  const cards = useAdminCards({
    q: q.trim() || undefined,
    cultureId: cultureId || undefined,
    type: type || undefined,
    published: status === '' ? undefined : status === 'published',
    page,
    pageSize: PAGE_SIZE,
  });
  const pages = cards.data ? Math.max(1, Math.ceil(cards.data.total / PAGE_SIZE)) : 1;

  /** Changing a filter starts from the first page. */
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <>
      <SectionHeader
        title={t('admin.sections.cards')}
        description={t('admin.cards.description')}
        action={
          <Button asChild data-testid="admin-add">
            <Link to="/admin/cards/new">{t('admin.add')}</Link>
          </Button>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <TextInput
          type="search"
          aria-label={t('admin.filters.query')}
          placeholder={t('admin.filters.query')}
          value={q}
          data-testid="admin-cards-query"
          onChange={(event) => setFilter('q', event.target.value)}
        />
        <Select
          aria-label={t('admin.filters.culture')}
          value={cultureId}
          onChange={(event) => setFilter('cultureId', event.target.value)}
        >
          <NamedOptions items={cultures.data} placeholder={t('admin.filters.allCultures')} />
        </Select>
        <Select
          aria-label={t('admin.filters.type')}
          value={type}
          onChange={(event) => setFilter('type', event.target.value)}
        >
          <option value="">{t('admin.filters.allTypes')}</option>
          {CARD_TYPES.map((cardType) => (
            <option key={cardType} value={cardType}>
              {t(`cardType.${cardType}`)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('admin.filters.status')}
          value={status}
          onChange={(event) => setFilter('status', event.target.value)}
        >
          <option value="">{t('admin.filters.allStatuses')}</option>
          <option value="published">{t('admin.cards.published')}</option>
          <option value="draft">{t('admin.cards.draft')}</option>
        </Select>
      </div>
      <LoadState isPending={cards.isPending} error={cards.error} />
      {cards.data && (
        <>
          <AdminTable
            rows={cards.data.items}
            rowKey={(card) => card.id}
            testId="admin-cards-table"
            columns={[
              {
                header: t('admin.fields.title'),
                cell: (card) => (
                  <Link
                    to={`/admin/cards/${card.id}`}
                    className="font-medium text-amber-800 underline dark:text-amber-300"
                  >
                    {card.title}
                  </Link>
                ),
              },
              { header: t('admin.fields.type'), cell: (card) => t(`cardType.${card.type}`) },
              { header: t('admin.fields.culture'), cell: (card) => card.culture.name },
              {
                header: t('admin.fields.period'),
                cell: (card) => formatPeriod(card.startYear, card.endYear),
              },
              {
                header: t('admin.fields.status'),
                cell: (card) =>
                  card.published ? (
                    <Badge>{t('admin.cards.published')}</Badge>
                  ) : (
                    <Badge variant="outline">{t('admin.cards.draft')}</Badge>
                  ),
              },
            ]}
            actions={(card) => (
              <Button
                size="sm"
                variant="outline"
                disabled={publish.isPending}
                data-testid={card.published ? 'admin-unpublish' : 'admin-publish'}
                aria-label={t(
                  card.published ? 'admin.cards.unpublishItem' : 'admin.cards.publishItem',
                  {
                    name: card.title,
                  },
                )}
                onClick={() => publish.mutate({ id: card.id, published: !card.published })}
              >
                {card.published ? t('admin.cards.unpublish') : t('admin.cards.publish')}
              </Button>
            )}
          />
          {pages > 1 && (
            <nav aria-label={t('admin.pagination')} className="mt-4 flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setFilter('page', String(page - 1))}
              >
                {t('admin.prev')}
              </Button>
              <span className="text-sm">{t('admin.pageOf', { page, pages })}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setFilter('page', String(page + 1))}
              >
                {t('admin.next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
