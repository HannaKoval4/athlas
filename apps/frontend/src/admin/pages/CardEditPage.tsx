import {
  type AdminCard,
  CARD_TYPES,
  type CardInput,
  type CardLinkInput,
  type CardSourceInput,
  RelationType,
  slugify,
} from '@atlas/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Field, FormSuccess } from '../../components/form.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Button } from '../../components/ui/button.tsx';
import {
  useAdminCard,
  useAdminDelete,
  useAttachSource,
  useCreateLink,
  useDeleteLink,
  useDetachSource,
  useSaveCard,
  useSetPublished,
} from '../api.ts';
import {
  CardPicker,
  DeleteButton,
  FieldRow,
  FormActions,
  LoadState,
  NamedOptions,
} from '../components.tsx';
import {
  useAdminErrorText,
  useCultureOptions,
  useSourceOptions,
  withSlugSuggestion,
} from '../hooks.ts';
import { AreaField, CheckField, InputField, SelectField } from '../fields.tsx';
import {
  type CardFormValues,
  type CardSourceFormValues,
  type LinkFormValues,
  cardForm,
  cardSchema,
  cardSourceSchema,
  linkSchema,
} from '../schemas.ts';

/** /admin/cards/new and /admin/cards/:id: the card form, publishing, links and sources. */
export function CardEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const isNew = id === undefined;
  const card = useAdminCard(id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link to="/admin/cards" className="text-sm text-amber-800 underline dark:text-amber-300">
          {t('admin.cards.back')}
        </Link>
        <h2 className="mt-2 text-xl font-semibold">
          {isNew ? t('admin.cards.create') : (card.data?.title ?? t('admin.cards.edit'))}
        </h2>
      </div>
      {isNew ? (
        <CardForm />
      ) : (
        <>
          <LoadState isPending={card.isPending} error={card.error} />
          {card.data && (
            <>
              <PublishPanel card={card.data} />
              {/* Keyed by id only: publishing changes updatedAt and must not reset unsaved edits. */}
              <CardForm key={card.data.id} card={card.data} />
              <LinksPanel card={card.data} />
              <SourcesPanel card={card.data} />
              <DeletePanel card={card.data} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function CardForm({ card }: { card?: AdminCard }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cultures = useCultureOptions();
  const save = useSaveCard();
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CardFormValues, unknown, CardInput>({
    resolver: zodResolver(cardSchema),
    defaultValues: cardForm(card),
  });
  const suggestSlug = () => {
    if (!getValues('slug')) setValue('slug', slugify(getValues('title')));
  };

  return (
    <form
      noValidate
      data-testid="admin-card-form"
      className="flex max-w-3xl flex-col gap-3"
      onSubmit={handleSubmit((input) =>
        save.mutate(
          { id: card?.id, input },
          // A new card continues on its own page, where links and sources can be added.
          {
            onSuccess: (saved) => {
              if (!card) void navigate(`/admin/cards/${saved.id}`, { replace: true });
            },
          },
        ),
      )}
    >
      <InputField
        label={t('admin.fields.title')}
        error={errors.title}
        registration={withSlugSuggestion(register('title'), suggestSlug)}
      />
      <FieldRow>
        <InputField
          label={t('admin.fields.slug')}
          hint={t('admin.hints.slug')}
          error={errors.slug}
          registration={register('slug')}
        />
        <SelectField
          label={t('admin.fields.type')}
          error={errors.type}
          registration={register('type')}
        >
          {CARD_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`cardType.${type}`)}
            </option>
          ))}
        </SelectField>
      </FieldRow>
      <SelectField
        label={t('admin.fields.culture')}
        error={errors.cultureId}
        registration={register('cultureId')}
      >
        <NamedOptions items={cultures.data} placeholder={t('admin.choose')} />
      </SelectField>
      <AreaField
        label={t('admin.fields.summary')}
        error={errors.summary}
        registration={register('summary')}
        rows={2}
      />
      <AreaField
        label={t('admin.fields.content')}
        hint={t('admin.hints.markdown')}
        error={errors.content}
        registration={register('content')}
        rows={10}
      />
      <FieldRow>
        <InputField
          label={t('admin.fields.startYear')}
          hint={t('admin.hints.year')}
          error={errors.startYear}
          registration={register('startYear')}
        />
        <InputField
          label={t('admin.fields.endYear')}
          error={errors.endYear}
          registration={register('endYear')}
        />
      </FieldRow>
      <FieldRow>
        <InputField
          label={t('admin.fields.day')}
          hint={t('admin.hints.cardDay')}
          inputMode="numeric"
          error={errors.day}
          registration={register('day')}
        />
        <InputField
          label={t('admin.fields.month')}
          inputMode="numeric"
          error={errors.month}
          registration={register('month')}
        />
      </FieldRow>
      <CheckField
        label={t('admin.fields.dateApproximate')}
        registration={register('dateApproximate')}
      />
      <FieldRow>
        <InputField
          type="url"
          label={t('admin.fields.imageUrl')}
          error={errors.imageUrl}
          registration={register('imageUrl')}
        />
        <InputField
          label={t('admin.fields.imageCredit')}
          error={errors.imageCredit}
          registration={register('imageCredit')}
        />
      </FieldRow>
      <InputField
        label={t('admin.fields.booksQuery')}
        hint={t('admin.hints.booksQuery')}
        error={errors.booksQuery}
        registration={register('booksQuery')}
      />
      <FormSuccess testId="admin-card-saved">
        {save.isSuccess && card ? t('admin.saved') : undefined}
      </FormSuccess>
      <FormActions pending={save.isPending} error={save.error} />
    </form>
  );
}

/** Draft / published status (BR-06); publishedAt itself is set by the database (DM-09). */
function PublishPanel({ card }: { card: AdminCard }) {
  const { t, i18n } = useTranslation();
  const publish = useSetPublished();
  const errorText = useAdminErrorText();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
      {card.published ? (
        <Badge data-testid="admin-card-status">{t('admin.cards.published')}</Badge>
      ) : (
        <Badge variant="outline" data-testid="admin-card-status">
          {t('admin.cards.draft')}
        </Badge>
      )}
      <span className="text-sm text-muted-foreground">
        {card.publishedAt
          ? t('admin.cards.publishedAt', {
              date: new Date(card.publishedAt).toLocaleString(i18n.language),
            })
          : t('admin.cards.draftHint')}
      </span>
      <Button
        className="ml-auto"
        variant={card.published ? 'outline' : 'default'}
        disabled={publish.isPending}
        data-testid={card.published ? 'admin-unpublish' : 'admin-publish'}
        onClick={() => publish.mutate({ id: card.id, published: !card.published })}
      >
        {card.published ? t('admin.cards.unpublish') : t('admin.cards.publish')}
      </Button>
      {card.published && (
        <Link
          to={`/cards/${card.slug}`}
          className="text-sm text-amber-800 underline dark:text-amber-300"
        >
          {t('admin.cards.open')}
        </Link>
      )}
      {publish.isError && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {errorText(publish.error)}
        </p>
      )}
    </div>
  );
}

/** DM-06, BR-18: links from this card; links to it are shown too and can be removed here. */
function LinksPanel({ card }: { card: AdminCard }) {
  const { t } = useTranslation();
  const create = useCreateLink();
  const remove = useDeleteLink();
  const errorText = useAdminErrorText();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkFormValues, unknown, Omit<CardLinkInput, 'fromCardId'>>({
    resolver: zodResolver(linkSchema),
    defaultValues: { toCardId: '', relationType: RelationType.RELATED },
  });

  return (
    <section aria-labelledby="admin-links-title" className="max-w-3xl" data-testid="admin-links">
      <h3 id="admin-links-title" className="mb-2 text-lg font-semibold">
        {t('admin.links.title')}
      </h3>
      {card.links.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">{t('admin.links.empty')}</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {card.links.map((link) => {
            const outgoing = link.fromCardId === card.id;
            const other = outgoing ? link.to : link.from;
            const key = `${link.fromCardId}-${link.toCardId}-${link.relationType}`;
            return (
              <li
                key={key}
                className="flex flex-wrap items-center gap-2 text-sm"
                data-testid="admin-link"
              >
                <span className="text-muted-foreground">
                  {t(`relation.${outgoing ? 'outgoing' : 'incoming'}.${link.relationType}`)}
                </span>
                <Link to={`/admin/cards/${other.id}`} className="underline">
                  {other.title}
                </Link>
                <DeleteButton
                  label={t('admin.deleteItem', { name: other.title })}
                  pending={remove.isPending}
                  error={remove.variables === link ? remove.error : undefined}
                  onConfirm={() => remove.mutate(link)}
                />
              </li>
            );
          })}
        </ul>
      )}
      <form
        noValidate
        className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
        onSubmit={handleSubmit((input) =>
          create.mutate({ ...input, fromCardId: card.id }, { onSuccess: () => reset() }),
        )}
      >
        <Controller
          control={control}
          name="toCardId"
          render={({ field }) => (
            <Field label={t('admin.links.target')} error={errors.toCardId?.message}>
              {({ id, describedBy, invalid }) => (
                <CardPicker
                  id={id}
                  describedBy={describedBy}
                  invalid={invalid}
                  excludeId={card.id}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            </Field>
          )}
        />
        <SelectField
          label={t('admin.links.relation')}
          error={errors.relationType}
          registration={register('relationType')}
        >
          {Object.values(RelationType).map((relation) => (
            <option key={relation} value={relation}>
              {t(`relation.outgoing.${relation}`)}
            </option>
          ))}
        </SelectField>
        <Button type="submit" disabled={create.isPending} data-testid="admin-link-add">
          {t('admin.links.add')}
        </Button>
        {create.isError && (
          <p role="alert" className="text-sm text-destructive sm:col-span-3">
            {errorText(create.error)}
          </p>
        )}
      </form>
    </section>
  );
}

function SourcesPanel({ card }: { card: AdminCard }) {
  const { t } = useTranslation();
  const sources = useSourceOptions();
  const attach = useAttachSource();
  const detach = useDetachSource();
  const errorText = useAdminErrorText();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CardSourceFormValues, unknown, Omit<CardSourceInput, 'cardId'>>({
    resolver: zodResolver(cardSourceSchema),
    defaultValues: { sourceId: '', pages: '' },
  });
  const attached = new Set(card.sources.map((source) => source.sourceId));
  const available = sources.data?.filter((source) => !attached.has(source.id));

  return (
    <section aria-labelledby="admin-sources-title" className="max-w-3xl">
      <h3 id="admin-sources-title" className="mb-2 text-lg font-semibold">
        {t('admin.cardSources.title')}
      </h3>
      {card.sources.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">{t('admin.cardSources.empty')}</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1">
          {card.sources.map((source) => (
            <li key={source.sourceId} className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                {source.source.title}
                {source.pages ? `, ${source.pages}` : ''}
              </span>
              <DeleteButton
                label={t('admin.deleteItem', { name: source.source.title })}
                pending={detach.isPending}
                error={detach.variables?.sourceId === source.sourceId ? detach.error : undefined}
                onConfirm={() => detach.mutate({ cardId: card.id, sourceId: source.sourceId })}
              />
            </li>
          ))}
        </ul>
      )}
      <form
        noValidate
        className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
        onSubmit={handleSubmit((input) =>
          attach.mutate({ ...input, cardId: card.id }, { onSuccess: () => reset() }),
        )}
      >
        <SelectField
          label={t('admin.fields.source')}
          error={errors.sourceId}
          registration={register('sourceId')}
        >
          <NamedOptions items={available} placeholder={t('admin.choose')} />
        </SelectField>
        <InputField
          label={t('admin.fields.pages')}
          error={errors.pages}
          registration={register('pages')}
        />
        <Button type="submit" disabled={attach.isPending}>
          {t('admin.cardSources.add')}
        </Button>
        {attach.isError && (
          <p role="alert" className="text-sm text-destructive sm:col-span-3">
            {errorText(attach.error)}
          </p>
        )}
      </form>
    </section>
  );
}

function DeletePanel({ card }: { card: AdminCard }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remove = useAdminDelete('cards');
  return (
    <section className="max-w-3xl rounded-lg border border-destructive/40 p-4">
      <h3 className="mb-1 font-semibold">{t('admin.cards.deleteTitle')}</h3>
      <p className="mb-3 text-sm text-muted-foreground">{t('admin.cards.deleteHint')}</p>
      <DeleteButton
        label={t('admin.deleteItem', { name: card.title })}
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() =>
          remove.mutate(card.id, {
            onSuccess: () => void navigate('/admin/cards', { replace: true }),
          })
        }
      />
    </section>
  );
}
