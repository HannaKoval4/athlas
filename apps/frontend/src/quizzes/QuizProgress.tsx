import type { QuizSummary } from '@atlas/shared';
import { Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge.tsx';

/** The user's best result and the "Эпоха изучена" mark of a quiz (BR-12, BR-13). */
export function QuizProgress({ quiz }: { quiz: QuizSummary }) {
  const { t } = useTranslation();
  if (!quiz.best) {
    return <span className="text-sm text-muted-foreground">{t('quiz.notTaken')}</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm" data-testid="quiz-progress">
      <span>
        {t('quiz.best', { score: quiz.best.score, total: quiz.best.total })} ·{' '}
        {t('quiz.attempts', { count: quiz.attempts })}
      </span>
      {quiz.best.passed && (
        <Badge className="gap-1" data-testid="quiz-studied">
          <Award aria-hidden="true" />
          {t('achievements.eraStudied')}
        </Badge>
      )}
    </span>
  );
}
