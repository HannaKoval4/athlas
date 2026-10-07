import type { CardType } from '@atlas/shared';

/** One colour per card type for the link graph and its legend (distinct, readable on white). */
export const CARD_TYPE_COLORS: Record<CardType, string> = {
  MYTHOLOGY: '#7c3aed',
  EVENT: '#dc2626',
  TRADITION: '#d97706',
  FACT: '#0891b2',
  ARTWORK: '#db2777',
  PERSON: '#16a34a',
  ARTIFACT: '#57534e',
};
