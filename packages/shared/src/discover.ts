import type { CardListItem, CultureRef, EraSummary } from './atlas.js';

/** Quiz state of an era + culture pair for the current user. */
export const TopicQuizStatus = {
  /** No quiz for this pair yet */
  NONE: 'NONE',
  NOT_PASSED: 'NOT_PASSED',
  PASSED: 'PASSED',
} as const;
export type TopicQuizStatus = (typeof TopicQuizStatus)[keyof typeof TopicQuizStatus];

/**
 * "Random topic" (F-12, BR-08): an era + culture pair that has published cards. The reason
 * is returned as data (number of cards, quiz state), so the client words it in its language.
 */
export interface RandomTopic {
  era: Pick<EraSummary, 'id' | 'slug' | 'name'>;
  culture: CultureRef;
  /** Published cards of the culture overlapping the era */
  cardsCount: number;
  quizStatus: TopicQuizStatus;
  /** Every filled pair already has a passed quiz, so the choice was made among all pairs */
  allQuizzesPassed: boolean;
  /** Year to open the map at: the middle of the era and culture periods' intersection */
  year: number;
}

export const FEED_DEFAULT_LIMIT = 10;
export const FEED_MAX_LIMIT = 50;

/** "New in the atlas" (F-13): published cards, newest first (DM-09). */
export interface FeedCard extends CardListItem {
  publishedAt: string;
}

export const VIEW_HISTORY_LIMIT = 20;

/** A card of the view history (BR-20). */
export interface ViewedCard extends CardListItem {
  viewedAt: string;
}

export interface RecordViewInput {
  cardId: string;
}
