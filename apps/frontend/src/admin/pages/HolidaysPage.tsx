import {
  type AdminHoliday,
  HolidayDateType,
  type HolidayInput,
  Season,
  slugify,
} from '@atlas/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, Select } from '../../components/form.tsx';
import { useAdminDelete, useAdminList, useAdminSave } from '../api.ts';
import {
  AddButton,
  AdminTable,
  CardPicker,
  DeleteButton,
  EditButton,
  EditorSheet,
  FieldRow,
  FormActions,
  LoadState,
  NamedOptions,
  SectionHeader,
} from '../components.tsx';
import { useCultureOptions, useEditor, useSourceOptions, withSlugSuggestion } from '../hooks.ts';
import { AreaField, InputField, SelectField } from '../fields.tsx';
import { type HolidayFormValues, holidayForm, holidaySchema } from '../schemas.ts';

export function HolidaysPage() {
  const { t } = useTranslation();
  const [cultureId, setCultureId] = useState('');
  const cultures = useCultureOptions();
  const holidays = useAdminList<AdminHoliday>('holidays', { cultureId: cultureId || undefined });
  const remove = useAdminDelete('holidays');
  const editor = useEditor<AdminHoliday>();

  const dateText = (holiday: AdminHoliday) => {
    if (holiday.dateType === HolidayDateType.EXACT && holiday.month && holiday.day) {
      return `${String(holiday.day).padStart(2, '0')}.${String(holiday.month).padStart(2, '0')}`;
    }
    if (holiday.season) return t(`season.${holiday.season}`);
    return t(`holidayDateType.${holiday.dateType}`);
  };

  return (
    <>
      <SectionHeader
        title={t('admin.sections.holidays')}
        description={t('admin.holidays.description')}
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
      <LoadState isPending={holidays.isPending} error={holidays.error} />
      {holidays.data && (
        <AdminTable
          rows={holidays.data}
          rowKey={(holiday) => holiday.id}
          columns={[
            { header: t('admin.fields.name'), cell: (holiday) => holiday.name },
            { header: t('admin.fields.culture'), cell: (holiday) => holiday.culture.name },
            { header: t('admin.fields.date'), cell: dateText },
          ]}
          actions={(holiday) => (
            <>
              <EditButton
                label={t('admin.editItem', { name: holiday.name })}
                onClick={() => editor.edit(holiday)}
              />
              <DeleteButton
                label={t('admin.deleteItem', { name: holiday.name })}
                pending={remove.isPending}
                error={remove.variables === holiday.id ? remove.error : undefined}
                onConfirm={() => remove.mutate(holiday.id)}
              />
            </>
          )}
        />
      )}
      <EditorSheet
        open={editor.open}
        onClose={editor.close}
        title={editor.item ? t('admin.holidays.edit') : t('admin.holidays.create')}
      >
        <HolidayForm
          key={editor.item?.id ?? 'new'}
          holiday={editor.item}
          defaultCultureId={cultureId}
          onDone={editor.close}
        />
      </EditorSheet>
    </>
  );
}

function HolidayForm({
  holiday,
  defaultCultureId,
  onDone,
}: {
  holiday?: AdminHoliday;
  defaultCultureId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const cultures = useCultureOptions();
  const sources = useSourceOptions();
  const save = useAdminSave<HolidayInput, AdminHoliday>('holidays');
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<HolidayFormValues, unknown, HolidayInput>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      ...holidayForm(holiday),
      ...(holiday ? {} : { cultureId: defaultCultureId }),
    },
  });
  const dateType = useWatch({ control, name: 'dateType' });
  // Fields of other date types are hidden, so they must not keep stale values (DM-05).
  useEffect(() => {
    if (dateType !== HolidayDateType.EXACT) {
      setValue('month', '');
      setValue('day', '');
    }
    if (dateType !== HolidayDateType.SEASON) setValue('season', '');
  }, [dateType, setValue]);
  const suggestSlug = () => {
    if (!getValues('slug')) setValue('slug', slugify(getValues('name')));
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((input) =>
        save.mutate({ id: holiday?.id, input }, { onSuccess: onDone }),
      )}
    >
      <InputField
        label={t('admin.fields.name')}
        error={errors.name}
        registration={withSlugSuggestion(register('name'), suggestSlug)}
      />
      <FieldRow>
        <InputField
          label={t('admin.fields.slug')}
          hint={t('admin.hints.slug')}
          error={errors.slug}
          registration={register('slug')}
        />
        <SelectField
          label={t('admin.fields.culture')}
          error={errors.cultureId}
          registration={register('cultureId')}
        >
          <NamedOptions items={cultures.data} placeholder={t('admin.choose')} />
        </SelectField>
      </FieldRow>
      <AreaField
        label={t('admin.fields.description')}
        error={errors.description}
        registration={register('description')}
      />
      <SelectField
        label={t('admin.fields.dateType')}
        hint={t('admin.hints.dateType')}
        error={errors.dateType}
        registration={register('dateType')}
      >
        {Object.values(HolidayDateType).map((type) => (
          <option key={type} value={type}>
            {t(`holidayDateType.${type}`)}
          </option>
        ))}
      </SelectField>
      {/* DM-05: only the fields of the chosen date type are shown. */}
      {dateType === HolidayDateType.EXACT && (
        <FieldRow>
          <InputField
            label={t('admin.fields.day')}
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
      )}
      {dateType === HolidayDateType.SEASON && (
        <SelectField
          label={t('admin.fields.season')}
          error={errors.season}
          registration={register('season')}
        >
          <option value="">{t('admin.choose')}</option>
          {Object.values(Season).map((season) => (
            <option key={season} value={season}>
              {t(`season.${season}`)}
            </option>
          ))}
        </SelectField>
      )}
      <InputField
        label={t('admin.fields.dateNote')}
        hint={t('admin.hints.dateNote')}
        error={errors.dateNote}
        registration={register('dateNote')}
      />
      <Controller
        control={control}
        name="cardId"
        render={({ field }) => (
          <Field label={t('admin.fields.card')} hint={t('admin.hints.holidayCard')}>
            {({ id, describedBy }) => (
              <CardPicker
                id={id}
                describedBy={describedBy}
                allowEmpty
                value={field.value}
                selectedTitle={holiday?.card?.title}
                onChange={field.onChange}
              />
            )}
          </Field>
        )}
      />
      <SelectField
        label={t('admin.fields.source')}
        error={errors.sourceId}
        registration={register('sourceId')}
      >
        <NamedOptions items={sources.data} placeholder={t('admin.none')} />
      </SelectField>
      <FormActions pending={save.isPending} error={save.error} onCancel={onDone} />
    </form>
  );
}
