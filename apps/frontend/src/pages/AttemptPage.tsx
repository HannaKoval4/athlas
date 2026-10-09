import type { QuestionReview } from '@atlas/shared';
import { Award, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { isApiError } from '../api/client.ts';
import { PageContainer } from '../components/AppLayout.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { buttonVariants } from '../components/ui/button.tsx';
import { useAttemptResult } from '../quizzes/api.ts';

/** /quizzes/attempts/:id: the score, the pass mark and the review of mistakes (BR-11, BR-14). */
export function AttemptPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const result = useAttemptResult(id);

  if (result.isPending) {
    return (
      <PageContainer>
        <p role="status">{t('app.loading')}</p>
      </PageContainer>
    );
  }
  if (result.isError) {
    return (
      <PageContainer>
        <p role="alert">
          {isApiError(result.error) && result.error.status === 404
            ? t('quiz.attemptNotFound')
            : t('quiz.loadError')}
        </p>
      </PageContainer>
    );
  }

  const data = result.data;
  const percent = data.total > 0 ? Math.round((data.score / data.total) * 100) : 0;
  const mistakes = data.review.filter((q) => !q.isCorrect).length;

  return (
    <PageContainer>
      <div className="flex max-w-3xl flex-col gap-6" data-testid="attempt-page">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {data.quiz.culture.name} · {data.quiz.era.name}
          </p>
          <h1 className="text-2xl font-bold">{data.quiz.title}</h1>
        </header>

        <section
          className={`flex flex-col gap-2 rounded-lg border p-4 ${data.passed ? 'border-green-600 bg-green-50 text-green-950' : 'border-amber-500 bg-amber-50 text-amber-950'}`}
          data-testid="attempt-score"
        >
          <p className="text-xl font-semibold">
            {t('quiz.score', { score: data.score, total: data.total, percent })}
          </p>
          <p>
            {data.passed ? t('quiz.passed') : t('quiz.failed', { percent: data.quiz.passPercent })}
          </p>
          {data.quiz.best && (
            <p className="text-sm">
              {t('quiz.best', { score: data.quiz.best.score, total: data.quiz.best.total })}
            </p>
          )}
        </section>

        {data.newAchievement && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-100 p-4 font-medium text-amber-950"
            data-testid="new-achievement"
          >
            <Award className="size-6 shrink-0" aria-hidden="true" />
            {t('achievements.earned', {
              title: t('achievements.eraStudied'),
              era: data.quiz.era.name,
              culture: data.quiz.culture.name,
            })}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/quizzes/${data.quiz.id}`}
            className={buttonVariants()}
            data-testid="attempt-retry"
          >
            {t('quiz.retake')}
          </Link>
          <Link
            to={`/cultures/${data.quiz.culture.slug}?era=${data.quiz.era.slug}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            {t('quiz.toCulture')}
          </Link>
        </div>

        <section aria-labelledby="review-title" className="flex flex-col gap-3">
          <h2 id="review-title" className="text-xl font-semibold">
            {mistakes > 0
              ? t('quiz.reviewMistakes', { count: mistakes })
              : t('quiz.reviewAllRight')}
          </h2>
          <ol className="flex flex-col gap-3">
            {data.review.map((question, index) => (
              <ReviewItem key={question.id} question={question} index={index} />
            ))}
          </ol>
        </section>
      </div>
    </PageContainer>
  );
}

function ReviewItem({ question, index }: { question: QuestionReview; index: number }) {
  const { t } = useTranslation();
  const selected = new Set(question.selectedOptionIds);

  return (
    <li
      className={`flex flex-col gap-2 rounded-lg border bg-card p-4 ${question.isCorrect ? '' : 'border-amber-500'}`}
      data-testid={question.isCorrect ? 'review-right' : 'review-wrong'}
    >
      <div className="flex items-start gap-2">
        {question.isCorrect ? (
          <Check className="mt-0.5 size-5 shrink-0 text-green-700" aria-label={t('quiz.right')} />
        ) : (
          <X className="mt-0.5 size-5 shrink-0 text-amber-700" aria-label={t('quiz.wrong')} />
        )}
        <p className="font-medium">
          {index + 1}. {question.text}
        </p>
      </div>
      {!question.isCorrect && (
        <>
          <ul className="flex flex-col gap-1 pl-7 text-sm">
            {question.options.map((option) => (
              <li key={option.id} className="flex flex-wrap items-center gap-2">
                <span className={option.isCorrect ? 'font-medium text-green-800' : ''}>
                  {option.text}
                </span>
                {option.isCorrect && <Badge variant="secondary">{t('quiz.correctOption')}</Badge>}
                {selected.has(option.id) && !option.isCorrect && (
                  <Badge variant="outline">{t('quiz.yourAnswer')}</Badge>
                )}
              </li>
            ))}
            {selected.size === 0 && <li className="text-muted-foreground">{t('quiz.skipped')}</li>}
          </ul>
          <p className="pl-7 text-sm">{question.explanation}</p>
          {question.card && (
            <Link
              to={`/cards/${question.card.slug}`}
              className="pl-7 text-sm underline underline-offset-2"
            >
              {t('quiz.revisit', { title: question.card.title })}
            </Link>
          )}
        </>
      )}
    </li>
  );
}
