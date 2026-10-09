import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '../components/ui/button.tsx';
import { useQuizzes } from './api.ts';
import { QuizProgress } from './QuizProgress.tsx';

/**
 * Bottom of the culture panel: "Пройти тест по эпохе" (F-15). The quiz of the era chosen on
 * the map comes first; quizzes of the culture's other eras follow. The quiz is never locked.
 */
export function CultureQuizzes({
  cultureId,
  eraSlug,
}: {
  cultureId: string;
  eraSlug: string | null;
}) {
  const { t } = useTranslation();
  const quizzes = useQuizzes({ cultureId });

  if (quizzes.isError) return <p role="alert">{t('quiz.loadError')}</p>;
  if (!quizzes.data || quizzes.data.length === 0) return null;

  const sorted = [...quizzes.data].sort(
    (a, b) => Number(b.era.slug === eraSlug) - Number(a.era.slug === eraSlug),
  );

  return (
    <section
      aria-labelledby="culture-quizzes"
      className="flex flex-col gap-3"
      data-testid="culture-quizzes"
    >
      <h3 id="culture-quizzes" className="text-lg font-semibold">
        {t('quiz.sectionTitle')}
      </h3>
      <ul className="flex flex-col gap-2">
        {sorted.map((quiz) => (
          <li
            key={quiz.id}
            className="flex flex-col gap-2 rounded-lg border bg-card p-3"
            data-testid={`culture-quiz-${quiz.era.slug}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {quiz.era.name}
                {quiz.era.slug === eraSlug && (
                  <span className="ml-2 text-xs text-muted-foreground">{t('quiz.currentEra')}</span>
                )}
              </span>
              <Link to={`/quizzes/${quiz.id}`} className={buttonVariants({ size: 'sm' })}>
                {t('quiz.take')}
              </Link>
            </div>
            <QuizProgress quiz={quiz} />
          </li>
        ))}
      </ul>
    </section>
  );
}
