import { Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button.tsx';
import { useRandomTopic } from './api.ts';
import type { RandomTopicState } from './random-topic-state.ts';

/**
 * "Random topic" (F-12): asks the server for a filled era + culture pair and opens that
 * culture on the map at a year inside both periods.
 */
export function RandomTopicButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const random = useRandomTopic();

  function pick() {
    random.mutate(undefined, {
      onSuccess: (topic) => {
        const search = new URLSearchParams({ era: topic.era.slug, year: String(topic.year) });
        const state: RandomTopicState = { randomTopic: topic };
        void navigate(
          { pathname: `/cultures/${topic.culture.slug}`, search: search.toString() },
          // Another random topic from the open panel replaces it instead of piling up history.
          { state, replace: location.pathname.startsWith('/cultures/') },
        );
      },
    });
  }

  return (
    <span className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={pick}
        disabled={random.isPending}
        data-testid="random-topic"
      >
        <Shuffle aria-hidden="true" />
        {t('random.button')}
      </Button>
      {random.isError && (
        <span role="alert" className="text-sm text-destructive">
          {t('random.error')}
        </span>
      )}
    </span>
  );
}
