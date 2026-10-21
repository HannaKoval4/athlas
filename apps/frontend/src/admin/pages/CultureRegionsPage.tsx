import type { AdminCultureRegion, CultureRegionInput } from '@atlas/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Select } from '../../components/form.tsx';
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
  NamedOptions,
  SectionHeader,
} from '../components.tsx';
import { useCultureOptions, useEditor, useRegionOptions } from '../hooks.ts';
import { CheckField, InputField, SelectField } from '../fields.tsx';
import {
  type CultureRegionFormValues,
  cultureRegionForm,
  cultureRegionSchema,
} from '../schemas.ts';

/** Which culture occupied which region when: this is what lights regions up on the map (DM-03). */
export function CultureRegionsPage() {
  const { t } = useTranslation();
  const { formatPeriod } = useYearFormat();
  const [cultureId, setCultureId] = useState('');
  const cultures = useCultureOptions();
  const periods = useAdminList<AdminCultureRegion>('culture-regions', {
    cultureId: cultureId || undefined,
  });
  const remove = useAdminDelete('culture-regions');
  const editor = useEditor<AdminCultureRegion>();

  return (
    <>
      <SectionHeader
        title={t('admin.sections.culture-regions')}
        description={t('admin.cultureRegions.description')}
        action={<AddButton onClick={editor.create} />}
      />
      <div className="mb-4 max-w-xs">
        <Select
          aria-label={t('admin.filters.culture')}
          value={cultureId}
          onChange={(event) => setCultureId(event.target.value)}
        >
          <NamedOptions items={cultures.data} placeholder={t('admin.filters.allCultures')} />
        </Select>
      </div>
      <LoadState isPending={periods.isPending} error={periods.error} />
      {periods.data && (
        <AdminTable
          rows={periods.data}
          rowKey={(period) => period.id}
          columns={[
            { header: t('admin.fields.culture'), cell: (period) => period.culture.name },
            { header: t('admin.fields.region'), cell: (period) => period.region.name },
            {
              header: t('admin.fields.period'),
              cell: (period) =>
                `${formatPeriod(period.startYear, period.endYear)}${
                  period.dateApproximate ? ` (${t('admin.approximate')})` : ''
                }`,
            },
          ]}
          actions={(period) => {
            const name = `${period.culture.name} – ${period.region.name}`;
            return (
              <>
                <EditButton
                  label={t('admin.editItem', { name })}
                  onClick={() => editor.edit(period)}
                />
                <DeleteButton
                  label={t('admin.deleteItem', { name })}
                  pending={remove.isPending}
                  error={remove.variables === period.id ? remove.error : undefined}
                  onConfirm={() => remove.mutate(period.id)}
                />
              </>
            );
          }}
        />
      )}
      <EditorSheet
        open={editor.open}
        onClose={editor.close}
        title={editor.item ? t('admin.cultureRegions.edit') : t('admin.cultureRegions.create')}
      >
        <CultureRegionForm
          key={editor.item?.id ?? 'new'}
          period={editor.item}
          defaultCultureId={cultureId}
          onDone={editor.close}
        />
      </EditorSheet>
    </>
  );
}

function CultureRegionForm({
  period,
  defaultCultureId,
  onDone,
}: {
  period?: AdminCultureRegion;
  defaultCultureId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const cultures = useCultureOptions();
  const regions = useRegionOptions();
  const save = useAdminSave<CultureRegionInput, AdminCultureRegion>('culture-regions');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CultureRegionFormValues, unknown, CultureRegionInput>({
    resolver: zodResolver(cultureRegionSchema),
    defaultValues: {
      ...cultureRegionForm(period),
      ...(period ? {} : { cultureId: defaultCultureId }),
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((input) =>
        save.mutate({ id: period?.id, input }, { onSuccess: onDone }),
      )}
    >
      <SelectField
        label={t('admin.fields.culture')}
        error={errors.cultureId}
        registration={register('cultureId')}
      >
        <NamedOptions items={cultures.data} placeholder={t('admin.choose')} />
      </SelectField>
      <SelectField
        label={t('admin.fields.region')}
        error={errors.regionId}
        registration={register('regionId')}
      >
        <NamedOptions items={regions.data} placeholder={t('admin.choose')} />
      </SelectField>
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
      <FormActions pending={save.isPending} error={save.error} onCancel={onDone} />
    </form>
  );
}
