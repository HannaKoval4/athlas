import { type CultureRef, middleYear, type RandomTopic, TopicQuizStatus } from '@atlas/shared';

/** A filled era + culture pair (BR-08) as read from the database. */
export interface TopicCandidate {
  era: RandomTopic['era'];
  culture: CultureRef;
  /** Intersection of the era and culture periods */
  fromYear: number;
  toYear: number;
  cardsCount: number;
  hasQuiz: boolean;
  quizPassed: boolean;
}

/**
 * BR-08: picks a random pair, preferring pairs whose quiz the user has not passed yet
 * (no quiz at all counts as "not passed"). Only when every pair is passed is the choice
 * made among all of them. `random` returns [0, 1) like Math.random (injected in tests).
 */
export function pickTopic(
  candidates: readonly TopicCandidate[],
  random: () => number = Math.random,
): RandomTopic | null {
  if (candidates.length === 0) return null;
  const notPassed = candidates.filter((candidate) => !candidate.quizPassed);
  const pool = notPassed.length > 0 ? notPassed : candidates;
  const index = Math.min(Math.floor(random() * pool.length), pool.length - 1);
  const chosen = pool[index];

  let quizStatus: TopicQuizStatus = TopicQuizStatus.NONE;
  if (chosen.quizPassed) quizStatus = TopicQuizStatus.PASSED;
  else if (chosen.hasQuiz) quizStatus = TopicQuizStatus.NOT_PASSED;

  return {
    era: chosen.era,
    culture: chosen.culture,
    cardsCount: chosen.cardsCount,
    quizStatus,
    allQuizzesPassed: notPassed.length === 0,
    year: middleYear(chosen.fromYear, chosen.toYear),
  };
}
