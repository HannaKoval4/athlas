import type { AdminQuestion, AdminQuiz, QuestionInput } from '@atlas/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Field, TextInput } from '../../components/form.tsx';
import { Button } from '../../components/ui/button.tsx';
import type { ValidationKey } from '../../i18n/index.ts';
import { useAdminDelete, useAdminList, useAdminSave } from '../api.ts';
import {
  AddButton,
  CardPicker,
  DeleteButton,
  EditButton,
  EditorSheet,
  FormActions,
  LoadState,
  SectionHeader,
} from '../components.tsx';
import { useEditor } from '../hooks.ts';
import { AreaField, CheckField } from '../fields.tsx';
import { type QuestionFormValues, questionForm, questionSchema } from '../schemas.ts';

/** The question pool of one quiz (BR-09: each attempt draws from it at random). */
export function QuestionsPage() {
  const { t } = useTranslation();
  const { id: quizId = '' } = useParams();
  const quizzes = useAdminList<AdminQuiz>('quizzes');
  const quiz = quizzes.data?.find((item) => item.id === quizId);
  const questions = useAdminList<AdminQuestion>('questions', { quizId });
  const remove = useAdminDelete('questions');
  const editor = useEditor<AdminQuestion>();

  return (
    <>
      <Link to="/admin/quizzes" className="text-sm text-amber-800 underline dark:text-amber-300">
        {t('admin.quizzes.back')}
      </Link>
      <div className="mt-2">
        <SectionHeader
          title={quiz?.title ?? t('admin.sections.quizzes')}
          description={
            quiz &&
            t('admin.quizzes.poolHint', {
              count: quiz.questionCount,
              perAttempt: quiz.questionsPerAttempt,
            })
          }
          action={<AddButton onClick={editor.create} />}
        />
      </div>
      <LoadState isPending={questions.isPending} error={questions.error} />
      {questions.data && questions.data.length === 0 && (
        <p className="text-muted-foreground">{t('admin.questions.empty')}</p>
      )}
      <ol className="flex flex-col gap-3">
        {questions.data?.map((question, index) => (
          <li
            key={question.id}
            className="rounded-lg border border-border p-3"
            data-testid="admin-question"
          >
            <div className="flex flex-wrap items-start gap-2">
              <p className="flex-1 font-medium">
                {index + 1}. {question.text}
                {question.multiple && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({t('admin.questions.multiple')})
                  </span>
                )}
              </p>
              <EditButton
                label={t('admin.editItem', { name: question.text })}
                onClick={() => editor.edit(question)}
              />
              <DeleteButton
                label={t('admin.deleteItem', { name: question.text })}
                pending={remove.isPending}
                error={remove.variables === question.id ? remove.error : undefined}
                onConfirm={() => remove.mutate(question.id)}
              />
            </div>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {question.options.map((option) => (
                <li
                  key={option.id}
                  className={
                    option.isCorrect ? 'font-semibold text-green-800 dark:text-green-300' : ''
                  }
                >
                  {option.isCorrect ? '✓ ' : '· '}
                  {option.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <EditorSheet
        open={editor.open}
        onClose={editor.close}
        title={editor.item ? t('admin.questions.edit') : t('admin.questions.create')}
      >
        <QuestionForm
          key={editor.item?.id ?? 'new'}
          quizId={quizId}
          question={editor.item}
          onDone={editor.close}
        />
      </EditorSheet>
    </>
  );
}

function QuestionForm({
  quizId,
  question,
  onDone,
}: {
  quizId: string;
  question?: AdminQuestion;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const save = useAdminSave<QuestionInput, AdminQuestion>('questions');
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QuestionFormValues, unknown, Omit<QuestionInput, 'quizId'>>({
    resolver: zodResolver(questionSchema),
    defaultValues: questionForm(question),
  });
  const options = useFieldArray({ control, name: 'options' });
  // The array-level rule (questionOptionsIssue) reports at "options".
  const optionsIssue = errors.options?.root?.message ?? errors.options?.message;

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={handleSubmit((input) =>
        save.mutate({ id: question?.id, input: { ...input, quizId } }, { onSuccess: onDone }),
      )}
    >
      <AreaField
        label={t('admin.fields.questionText')}
        error={errors.text}
        registration={register('text')}
        rows={2}
      />
      <CheckField label={t('admin.questions.multipleLabel')} registration={register('multiple')} />
      <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <legend className="px-1 font-medium">{t('admin.questions.options')}</legend>
        <p className="text-sm text-muted-foreground">{t('admin.hints.options')}</p>
        {options.fields.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2" data-testid="admin-option">
            <input
              type="checkbox"
              aria-label={t('admin.questions.correct', { index: index + 1 })}
              className="size-4 accent-green-700"
              data-testid={`admin-option-correct-${index}`}
              {...register(`options.${index}.isCorrect`)}
            />
            <TextInput
              aria-label={t('admin.questions.optionText', { index: index + 1 })}
              aria-invalid={Boolean(errors.options?.[index]?.text)}
              data-testid={`admin-option-text-${index}`}
              {...register(`options.${index}.text`)}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={t('admin.questions.removeOption', { index: index + 1 })}
              onClick={() => options.remove(index)}
            >
              ✕
            </Button>
          </div>
        ))}
        {optionsIssue && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {t(`validation.${optionsIssue as ValidationKey}`)}
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => options.append({ optionId: '', text: '', isCorrect: false })}
        >
          {t('admin.questions.addOption')}
        </Button>
      </fieldset>
      <AreaField
        label={t('admin.fields.explanation')}
        hint={t('admin.hints.explanation')}
        error={errors.explanation}
        registration={register('explanation')}
        rows={3}
      />
      <Controller
        control={control}
        name="cardId"
        render={({ field }) => (
          <Field label={t('admin.fields.reviewCard')} hint={t('admin.hints.reviewCard')}>
            {({ id, describedBy }) => (
              <CardPicker
                id={id}
                describedBy={describedBy}
                allowEmpty
                value={field.value}
                selectedTitle={question?.card?.title}
                onChange={field.onChange}
              />
            )}
          </Field>
        )}
      />
      <FormActions pending={save.isPending} error={save.error} onCancel={onDone} />
    </form>
  );
}
