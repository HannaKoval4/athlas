import { type AdminCulture, type CultureInput, slugify } from '@atlas/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useYearFormat } from '../../i18n/use-year-format.ts';
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
import { AreaField, CheckField, InputField } from '../fields.tsx';
import { type CultureFormValues, cultureForm, cultureSchema } from '../schemas.ts';

export function CulturesPage() {
  const { t } = useTranslation();
  const { formatPeriod } = useYearFormat();
  const cultures = useAdminList<AdminCulture>('cultures');
  const remove = useAdminDelete('cultures');
  const editor = useEditor<AdminCulture>();

  return (
    <>
      <SectionHeader
        title={t('admin.sections.cultures')}
        description={t('admin.cultures.description')}
        action={<AddButton onClick={editor.create} />}
      />
      <LoadState isPending={cultures.isPending} error={cultures.error} />
      {cultures.data && (
        <AdminTable
          rows={cultures.data}
          rowKey={(culture) => culture.id}
          columns={[
            {
              header: t('admin.fields.name'),
              cell: (culture) => (
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-3 rounded-full"
                    style={{ backgroundColor: culture.color }}
                  />
                  {culture.name}
                </span>
              ),
            },
            {
              header: t('admin.fields.period'),
              cell: (culture) => formatPeriod(culture.startYear, culture.endYear),
            },
            { header: t('admin.cultures.cards'), cell: (culture) => culture.cardCount },
          ]}
          actions={(culture) => (
            <>
              <EditButton
                label={t('admin.editItem', { name: culture.name })}
                onClick={() => editor.edit(culture)}
              />
              <DeleteButton
                label={t('admin.deleteItem', { name: culture.name })}
                pending={remove.isPending}
                error={remove.variables === culture.id ? remove.error : undefined}
                onConfirm={() => remove.mutate(culture.id)}
              />
            </>
          )}
        />
      )}
      <EditorSheet
        open={editor.open}
        onClose={editor.close}
        title={editor.item ? t('admin.cultures.edit') : t('admin.cultures.create')}
      >
        <CultureForm key={editor.item?.id ?? 'new'} culture={editor.item} onDone={editor.close} />
      </EditorSheet>
    </>
  );
}

function CultureForm({ culture, onDone }: { culture?: AdminCulture; onDone: () => void }) {
  const { t } = useTranslation();
  const save = useAdminSave<CultureInput, AdminCulture>('cultures');
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CultureFormValues, unknown, CultureInput>({
    resolver: zodResolver(cultureSchema),
    defaultValues: cultureForm(culture),
  });
  const suggestSlug = () => {
    if (!getValues('slug')) setValue('slug', slugify(getValues('name')));
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((input) =>
        save.mutate({ id: culture?.id, input }, { onSuccess: onDone }),
      )}
    >
      <InputField
        label={t('admin.fields.name')}
        error={errors.name}
        registration={withSlugSuggestion(register('name'), suggestSlug)}
      />
      <InputField
        label={t('admin.fields.slug')}
        hint={t('admin.hints.slug')}
        error={errors.slug}
        registration={register('slug')}
      />
      <AreaField
        label={t('admin.fields.description')}
        error={errors.description}
        registration={register('description')}
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
      <CheckField
        label={t('admin.fields.dateApproximate')}
        registration={register('dateApproximate')}
      />
      <FieldRow>
        <InputField
          type="color"
          label={t('admin.fields.color')}
          hint={t('admin.hints.color')}
          error={errors.color}
          registration={register('color')}
        />
        <InputField
          label={t('admin.fields.booksQuery')}
          hint={t('admin.hints.booksQuery')}
          error={errors.booksQuery}
          registration={register('booksQuery')}
        />
      </FieldRow>
      <FormActions pending={save.isPending} error={save.error} onCancel={onDone} />
    </form>
  );
}
