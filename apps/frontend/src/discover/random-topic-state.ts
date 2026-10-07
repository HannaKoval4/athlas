import type { RandomTopic } from '@atlas/shared';

/** Navigation state that carries the chosen topic to the culture panel, which explains it. */
export interface RandomTopicState {
  randomTopic: RandomTopic;
}

export function readRandomTopic(state: unknown): RandomTopic | null {
  return state && typeof state === 'object' && 'randomTopic' in state
    ? (state as RandomTopicState).randomTopic
    : null;
}
