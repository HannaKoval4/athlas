import { type AdminRegion, type RegionInput, slugify } from '@atlas/shared';
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
import { AreaField, InputField } from '../fields.tsx';
import { type RegionFormValues, regionForm, regionSchema } from '../schemas.ts';

export function RegionsPage() {
  const { t } = useTranslation();
  const regions = useAdminList<AdminRegion>('regions');
  const remove = useAdminDelete('regions');
  const editor = useEditor<AdminRegion>();

  return (
    <>
      <SectionHeader
        title={t('admin.sections.regions')}
        description={t('admin.regions.description')}
        action={<AddButton onClick={editor.create} />}
      />
      <LoadState isPending={regions.isPending} error={regions.error} />
      {regions.data && (
        <AdminTable
          rows={regions.data}
          rowKey={(region) => region.id}
          columns={[
            { header: t('admin.fields.name'), cell: (region) => region.name },
            { header: t('admin.fields.slug'), cell: (region) => region.slug },
            {
              header: t('admin.regions.shape'),
              cell: (region) => region.geojson.type,
            },
            { header: t('admin.regions.periods'), cell: (region) => region.periodCount },
          ]}
          actions={(region) => (
            <>
              <EditButton
                label={t('admin.editItem', { name: region.name })}
                onClick={() => editor.edit(region)}
              />
              <DeleteButton
                label={t('admin.deleteItem', { name: region.name })}
                pending={remove.isPending}
                error={remove.variables === region.id ? remove.error : undefined}
                onConfirm={() => remove.mutate(region.id)}
              />
            </>
          )}
        />
      )}
      <EditorSheet
        open={editor.open}
        onClose={editor.close}
        title={editor.item ? t('admin.regions.edit') : t('admin.regions.create')}
        description={t('admin.regions.bordersNote')}
      >
        <RegionForm key={editor.item?.id ?? 'new'} region={editor.item} onDone={editor.close} />
      </EditorSheet>
    </>
  );
}

function RegionForm({ region, onDone }: { region?: AdminRegion; onDone: () => void }) {
  const { t } = useTranslation();
  const save = useAdminSave<RegionInput, AdminRegion>('regions');
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<RegionFormValues, unknown, RegionInput>({
    resolver: zodResolver(regionSchema),
    defaultValues: regionForm(region),
  });
  const suggestSlug = () => {
    if (!getValues('slug')) setValue('slug', slugify(getValues('name')));
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((input) =>
        save.mutate({ id: region?.id, input }, { onSuccess: onDone }),
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
        label={t('admin.fields.geojson')}
        hint={t('admin.hints.geojson')}
        error={errors.geojson}
        registration={register('geojson')}
        rows={10}
      />
      <FieldRow>
        <InputField
          label={t('admin.fields.centerLat')}
          inputMode="decimal"
          error={errors.centerLat}
          registration={register('centerLat')}
        />
        <InputField
          label={t('admin.fields.centerLng')}
          inputMode="decimal"
          error={errors.centerLng}
          registration={register('centerLng')}
        />
      </FieldRow>
      <FormActions pending={save.isPending} error={save.error} onCancel={onDone} />
    </form>
  );
}
