import { Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { readRandomTopic } from './random-topic-state.ts';

/** Why the random topic was chosen (BR-08); shown in the culture panel it opened. */
export function RandomTopicNote({ cultureSlug }: { cultureSlug: string }) {
  const { t } = useTranslation();
  const topic = readRandomTopic(useLocation().state);
  if (!topic || topic.culture.slug !== cultureSlug) return null;

  const quiz = topic.allQuizzesPassed
    ? t('random.allPassed')
    : t(`random.quiz.${topic.quizStatus}`);

  return (
    <p
      className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
      data-testid="random-topic-reason"
    >
      <Shuffle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium">
          {t('random.chosen', { era: topic.era.name, culture: topic.culture.name })}
        </span>{' '}
        {t('random.reason', { count: topic.cardsCount })} {quiz}
      </span>
    </p>
  );
}
