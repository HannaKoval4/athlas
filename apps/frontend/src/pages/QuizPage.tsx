import type { AttemptQuestion, StartedAttempt } from '@atlas/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { isApiError } from '../api/client.ts';
import { PageContainer } from '../components/AppLayout.tsx';
import { Button } from '../components/ui/button.tsx';
import { useQuiz, useStartAttempt, useSubmitAttempt } from '../quizzes/api.ts';
import { QuizProgress } from '../quizzes/QuizProgress.tsx';

/**
 * /quizzes/:id (F-15): the quiz intro, then the drawn questions on one page. Answers are
 * checked only on the server; the result page shows the score and the review.
 */
export function QuizPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const quiz = useQuiz(id);
  const startAttempt = useStartAttempt();
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);

  if (quiz.isPending) {
    return (
      <PageContainer>
        <p role="status">{t('app.loading')}</p>
      </PageContainer>
    );
  }
  if (quiz.isError) {
    return (
      <PageContainer>
        <div role="alert" className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">
            {isApiError(quiz.error) && quiz.error.status === 404
              ? t('quiz.notFound')
              : t('quiz.loadError')}
          </h1>
          <Link to="/" className="underline">
            {t('card.toMap')}
          </Link>
        </div>
      </PageContainer>
    );
  }

  const data = quiz.data;
  const count = Math.min(data.poolSize, data.questionsPerAttempt);

  return (
    <PageContainer>
      <div className="flex max-w-3xl flex-col gap-6" data-testid="quiz-page">
        <header className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: data.culture.color }}
            />
            {data.culture.name} · {data.era.name}
          </p>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <QuizProgress quiz={data} />
        </header>

        {attempt ? (
          <AttemptForm attempt={attempt} />
        ) : (
          <section className="flex flex-col items-start gap-3">
            <p>{t('quiz.rules', { count, percent: data.passPercent })}</p>
            {startAttempt.isError && (
              <p role="alert" className="text-destructive">
                {isApiError(startAttempt.error) && startAttempt.error.status === 409
                  ? t('quiz.noQuestions')
                  : t('quiz.startError')}
              </p>
            )}
            <Button
              data-testid="quiz-start"
              disabled={startAttempt.isPending || data.poolSize === 0}
              onClick={() => startAttempt.mutate(id, { onSuccess: setAttempt })}
            >
              {data.best ? t('quiz.retake') : t('quiz.start')}
            </Button>
          </section>
        )}
      </div>
    </PageContainer>
  );
}

function AttemptForm({ attempt }: { attempt: StartedAttempt }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const submit = useSubmitAttempt();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const answered = attempt.questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;
  const total = attempt.questions.length;

  function choose(question: AttemptQuestion, optionId: string, checked: boolean) {
    setAnswers((current) => {
      const chosen = current[question.id] ?? [];
      const next = question.multiple
        ? checked
          ? [...chosen, optionId]
          : chosen.filter((id) => id !== optionId)
        : [optionId];
      return { ...current, [question.id]: next };
    });
  }

  function send() {
    submit.mutate(
      {
        attemptId: attempt.id,
        answers: attempt.questions.map((q) => ({
          questionId: q.id,
          optionIds: answers[q.id] ?? [],
        })),
      },
      { onSuccess: (result) => void navigate(`/quizzes/attempts/${result.id}`, { replace: true }) },
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      data-testid="quiz-form"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <ol className="flex flex-col gap-4">
        {attempt.questions.map((question, index) => (
          <li key={question.id}>
            <fieldset
              className="flex flex-col gap-2 rounded-lg border bg-card p-4"
              data-testid="quiz-question"
            >
              <legend className="px-1 font-medium">
                {index + 1}. {question.text}
              </legend>
              {question.multiple && (
                <p className="text-sm text-muted-foreground">{t('quiz.multipleHint')}</p>
              )}
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md p-1 hover:bg-muted"
                >
                  <input
                    type={question.multiple ? 'checkbox' : 'radio'}
                    name={question.id}
                    value={option.id}
                    className="mt-1 accent-amber-800"
                    checked={answers[question.id]?.includes(option.id) ?? false}
                    onChange={(event) => choose(question, option.id, event.target.checked)}
                  />
                  <span>{option.text}</span>
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t bg-background py-3">
        <span aria-live="polite" className="text-sm" data-testid="quiz-answered">
          {t('quiz.answered', { answered, total })}
        </span>
        <Button
          type="submit"
          disabled={answered < total || submit.isPending}
          data-testid="quiz-submit"
        >
          {t('quiz.submit')}
        </Button>
        {answered < total && (
          <span className="text-sm text-muted-foreground">{t('quiz.answerAll')}</span>
        )}
        {submit.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t('quiz.submitError')}
          </p>
        )}
      </div>
    </form>
  );
}
