import type { CultureRef, EraSummary } from './atlas.js';

export type QuizEraRef = Pick<EraSummary, 'id' | 'slug' | 'name'>;

/** The user's best finished attempt (BR-12): the maximum score. */
export interface QuizBest {
  score: number;
  total: number;
  passed: boolean;
}

/** A quiz of an era + culture pair with the user's progress (F-15). */
export interface QuizSummary {
  id: string;
  title: string;
  era: QuizEraRef;
  culture: CultureRef;
  questionsPerAttempt: number;
  passPercent: number;
  /** Questions in the pool; an attempt draws min(pool, questionsPerAttempt) of them */
  poolSize: number;
  best: QuizBest | null;
  /** Finished attempts of the user */
  attempts: number;
}

export interface QuizzesQuery {
  eraId?: string;
  cultureId?: string;
}

/** An option as the user sees it during an attempt: no isCorrect (BR-10). */
export interface AttemptOption {
  id: string;
  text: string;
}

export interface AttemptQuestion {
  id: string;
  text: string;
  /** Several options may be correct; the chosen set must match exactly (BR-10) */
  multiple: boolean;
  /** Shuffled for every attempt (BR-09) */
  options: AttemptOption[];
}

/** A started attempt: the drawn questions, without answers. */
export interface StartedAttempt {
  id: string;
  quiz: QuizSummary;
  questions: AttemptQuestion[];
}

export interface SubmittedAnswer {
  questionId: string;
  optionIds: string[];
}

export interface SubmitAttemptInput {
  answers: SubmittedAnswer[];
}

/** Review of one question after the attempt (BR-14). */
export interface QuestionReview {
  id: string;
  text: string;
  multiple: boolean;
  options: (AttemptOption & { isCorrect: boolean })[];
  selectedOptionIds: string[];
  isCorrect: boolean;
  explanation: string;
  /** The card to revisit */
  card: { slug: string; title: string } | null;
}

export interface Achievement {
  code: string;
  /** i18n key of the title */
  titleKey: string;
  /** The quiz the achievement was earned for */
  quiz: Pick<QuizSummary, 'id' | 'title' | 'era' | 'culture'> | null;
  earnedAt: string;
}

export interface AttemptResult {
  id: string;
  quiz: QuizSummary;
  score: number;
  total: number;
  /** score / total * 100 >= passPercent (BR-11) */
  passed: boolean;
  finishedAt: string;
  review: QuestionReview[];
  /** Earned by this attempt (BR-13: only the first pass earns it) */
  newAchievement: Achievement | null;
}

/** "Эпоха изучена" (F-16): one achievement per quiz. */
export const ERA_STUDIED_TITLE_KEY = 'achievements.eraStudied';

export function eraStudiedCode(quizId: string): string {
  return `ERA_STUDIED:${quizId}`;
}

/** BR-11: passed when the share of correct answers reaches the pass mark. */
export function isPassed(score: number, total: number, passPercent: number): boolean {
  return total > 0 && (score / total) * 100 >= passPercent;
}

/** BR-10: an answer is correct when the chosen set equals the correct set exactly. */
export function isExactMatch(selected: readonly string[], correct: readonly string[]): boolean {
  const chosen = new Set(selected);
  return chosen.size === correct.length && correct.every((id) => chosen.has(id));
}
