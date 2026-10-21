import type { AdminQuiz, QuizInput } from '@atlas/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
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
import { useCultureOptions, useEditor, useEraOptions } from '../hooks.ts';
import { InputField, SelectField } from '../fields.tsx';
import { type QuizFormValues, quizForm, quizSchema } from '../schemas.ts';

/** One quiz per era + culture (DM-08); its question pool is edited on the quiz's own page. */
export function QuizzesPage() {
  const { t } = useTranslation();
  const quizzes = useAdminList<AdminQuiz>('quizzes');
  const remove = useAdminDelete('quizzes');
  const editor = useEditor<AdminQuiz>();

  return (
    <>
      <SectionHeader
        title={t('admin.sections.quizzes')}
        description={t('admin.quizzes.description')}
        action={<AddButton onClick={editor.create} />}
      />
      <LoadState isPending={quizzes.isPending} error={quizzes.error} />
      {quizzes.data && (
        <AdminTable
          rows={quizzes.data}
          rowKey={(quiz) => quiz.id}
          columns={[
            {
              header: t('admin.fields.title'),
              cell: (quiz) => (
                <Link
                  to={`/admin/quizzes/${quiz.id}`}
                  className="font-medium text-amber-800 underline dark:text-amber-300"
                >
                  {quiz.title}
                </Link>
              ),
            },
            { header: t('admin.fields.era'), cell: (quiz) => quiz.era.name },
            { header: t('admin.fields.culture'), cell: (quiz) => quiz.culture.name },
            {
              header: t('admin.quizzes.pool'),
              cell: (quiz) =>
                t('admin.quizzes.poolValue', {
                  count: quiz.questionCount,
                  perAttempt: quiz.questionsPerAttempt,
                }),
            },
            { header: t('admin.fields.passPercent'), cell: (quiz) => `${quiz.passPercent} %` },
          ]}
          actions={(quiz) => (
            <>
              <EditButton
                label={t('admin.editItem', { name: quiz.title })}
                onClick={() => editor.edit(quiz)}
              />
              <DeleteButton
                label={t('admin.deleteItem', { name: quiz.title })}
                pending={remove.isPending}
                error={remove.variables === quiz.id ? remove.error : undefined}
                onConfirm={() => remove.mutate(quiz.id)}
              />
            </>
          )}
        />
      )}
      <EditorSheet
        open={editor.open}
        onClose={editor.close}
        title={editor.item ? t('admin.quizzes.edit') : t('admin.quizzes.create')}
        description={editor.item ? undefined : t('admin.quizzes.createHint')}
      >
        <QuizForm key={editor.item?.id ?? 'new'} quiz={editor.item} onDone={editor.close} />
      </EditorSheet>
    </>
  );
}

function QuizForm({ quiz, onDone }: { quiz?: AdminQuiz; onDone: () => void }) {
  const { t } = useTranslation();
  const eras = useEraOptions();
  const cultures = useCultureOptions();
  const save = useAdminSave<QuizInput, AdminQuiz>('quizzes');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuizFormValues, unknown, QuizInput>({
    resolver: zodResolver(quizSchema),
    defaultValues: quizForm(quiz),
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((input) =>
        save.mutate({ id: quiz?.id, input }, { onSuccess: onDone }),
      )}
    >
      <InputField
        label={t('admin.fields.title')}
        error={errors.title}
        registration={register('title')}
      />
      <FieldRow>
        <SelectField
          label={t('admin.fields.era')}
          error={errors.eraId}
          registration={register('eraId')}
        >
          <NamedOptions items={eras.data} placeholder={t('admin.choose')} />
        </SelectField>
        <SelectField
          label={t('admin.fields.culture')}
          error={errors.cultureId}
          registration={register('cultureId')}
        >
          <NamedOptions items={cultures.data} placeholder={t('admin.choose')} />
        </SelectField>
      </FieldRow>
      <FieldRow>
        <InputField
          label={t('admin.fields.questionsPerAttempt')}
          hint={t('admin.hints.questionsPerAttempt')}
          inputMode="numeric"
          error={errors.questionsPerAttempt}
          registration={register('questionsPerAttempt')}
        />
        <InputField
          label={t('admin.fields.passPercent')}
          inputMode="numeric"
          error={errors.passPercent}
          registration={register('passPercent')}
        />
      </FieldRow>
      <FormActions pending={save.isPending} error={save.error} onCancel={onDone} />
    </form>
  );
}
