import { type AdminSource, type SourceInput, SourceType, slugify } from '@atlas/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAdminDelete, useAdminList, useAdminSave } from '../api.ts';
import {
  AddButton,
  AdminTable,
  DeleteButton,
  EditButton,
  EditorSheet,
  FieldRow,
  FormActions,
  LoadState,
  SectionHeader,
} from '../components.tsx';
import { useEditor, withSlugSuggestion } from '../hooks.ts';
import { InputField, SelectField } from '../fields.tsx';
import { type SourceFormValues, sourceForm, sourceSchema } from '../schemas.ts';

export function SourcesPage() {
  const { t } = useTranslation();
  const sources = useAdminList<AdminSource>('sources');
  const remove = useAdminDelete('sources');
  const editor = useEditor<AdminSource>();

  return (
    <>
      <SectionHeader
        title={t('admin.sections.sources')}
        description={t('admin.sources.description')}
        action={<AddButton onClick={editor.create} />}
      />
      <LoadState isPending={sources.isPending} error={sources.error} />
      {sources.data && (
        <AdminTable
          rows={sources.data}
          rowKey={(source) => source.id}
          columns={[
            {
              header: t('admin.fields.title'),
              cell: (source) =>
                source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-800 underline dark:text-amber-300"
                  >
                    {source.title}
                  </a>
                ) : (
                  source.title
                ),
            },
            {
              header: t('admin.fields.sourceType'),
              cell: (source) => t(`admin.sourceType.${source.type}`),
            },
            { header: t('admin.fields.author'), cell: (source) => source.author ?? '–' },
            { header: t('admin.sources.cards'), cell: (source) => source.cardCount },
          ]}
          actions={(source) => (
            <>
              <EditButton
                label={t('admin.editItem', { name: source.title })}
                onClick={() => editor.edit(source)}
              />
              <DeleteButton
                label={t('admin.deleteItem', { name: source.title })}
                pending={remove.isPending}
                error={remove.variables === source.id ? remove.error : undefined}
                onConfirm={() => remove.mutate(source.id)}
              />
            </>
          )}
        />
      )}
      <EditorSheet
        open={editor.open}
        onClose={editor.close}
        title={editor.item ? t('admin.sources.edit') : t('admin.sources.create')}
      >
        <SourceForm key={editor.item?.id ?? 'new'} source={editor.item} onDone={editor.close} />
      </EditorSheet>
    </>
  );
}

function SourceForm({ source, onDone }: { source?: AdminSource; onDone: () => void }) {
  const { t } = useTranslation();
  const save = useAdminSave<SourceInput, AdminSource>('sources');
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<SourceFormValues, unknown, SourceInput>({
    resolver: zodResolver(sourceSchema),
    defaultValues: sourceForm(source),
  });
  const suggestSlug = () => {
    if (!getValues('slug')) setValue('slug', slugify(getValues('title')));
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((input) =>
        save.mutate({ id: source?.id, input }, { onSuccess: onDone }),
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
          label={t('admin.fields.sourceType')}
          error={errors.type}
          registration={register('type')}
        >
          {Object.values(SourceType).map((type) => (
            <option key={type} value={type}>
              {t(`admin.sourceType.${type}`)}
            </option>
          ))}
        </SelectField>
      </FieldRow>
      <FieldRow>
        <InputField
          label={t('admin.fields.author')}
          error={errors.author}
          registration={register('author')}
        />
        <InputField
          label={t('admin.fields.publisher')}
          error={errors.publisher}
          registration={register('publisher')}
        />
      </FieldRow>
      <FieldRow>
        <InputField
          label={t('admin.fields.year')}
          error={errors.year}
          registration={register('year')}
        />
        <InputField
          type="date"
          label={t('admin.fields.accessedAt')}
          error={errors.accessedAt}
          registration={register('accessedAt')}
        />
      </FieldRow>
      <InputField
        type="url"
        label={t('admin.fields.url')}
        error={errors.url}
        registration={register('url')}
      />
      <FormActions pending={save.isPending} error={save.error} onCancel={onDone} />
    </form>
  );
}
