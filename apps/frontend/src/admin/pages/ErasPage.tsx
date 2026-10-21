import { type AdminEra, type EraInput, slugify } from '@atlas/shared';
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
import { AreaField, InputField } from '../fields.tsx';
import { type EraFormValues, eraForm, eraSchema } from '../schemas.ts';

export function ErasPage() {
  const { t } = useTranslation();
  const { formatPeriod } = useYearFormat();
  const eras = useAdminList<AdminEra>('eras');
  const remove = useAdminDelete('eras');
  const editor = useEditor<AdminEra>();

  return (
    <>
      <SectionHeader
        title={t('admin.sections.eras')}
        description={t('admin.eras.description')}
        action={<AddButton onClick={editor.create} />}
      />
      <LoadState isPending={eras.isPending} error={eras.error} />
      {eras.data && (
        <AdminTable
          rows={eras.data}
          rowKey={(era) => era.id}
          columns={[
            { header: t('admin.fields.sortOrder'), cell: (era) => era.sortOrder },
            { header: t('admin.fields.name'), cell: (era) => era.name },
            {
              header: t('admin.fields.period'),
              cell: (era) => formatPeriod(era.startYear, era.endYear),
            },
            { header: t('admin.eras.quizzes'), cell: (era) => era.quizCount },
          ]}
          actions={(era) => (
            <>
              <EditButton
                label={t('admin.editItem', { name: era.name })}
                onClick={() => editor.edit(era)}
              />
              <DeleteButton
                label={t('admin.deleteItem', { name: era.name })}
                pending={remove.isPending}
                error={remove.variables === era.id ? remove.error : undefined}
                onConfirm={() => remove.mutate(era.id)}
              />
            </>
          )}
        />
      )}
      <EditorSheet
        open={editor.open}
        onClose={editor.close}
        title={editor.item ? t('admin.eras.edit') : t('admin.eras.create')}
      >
        <EraForm key={editor.item?.id ?? 'new'} era={editor.item} onDone={editor.close} />
      </EditorSheet>
    </>
  );
}

function EraForm({ era, onDone }: { era?: AdminEra; onDone: () => void }) {
  const { t } = useTranslation();
  const save = useAdminSave<EraInput, AdminEra>('eras');
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<EraFormValues, unknown, EraInput>({
    resolver: zodResolver(eraSchema),
    defaultValues: eraForm(era),
  });
  const suggestSlug = () => {
    if (!getValues('slug')) setValue('slug', slugify(getValues('name')));
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((input) => save.mutate({ id: era?.id, input }, { onSuccess: onDone }))}
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
      <InputField
        label={t('admin.fields.sortOrder')}
        hint={t('admin.hints.sortOrder')}
        error={errors.sortOrder}
        registration={register('sortOrder')}
      />
      <FormActions pending={save.isPending} error={save.error} onCancel={onDone} />
    </form>
  );
}
