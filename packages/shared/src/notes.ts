import type { CardType } from './enums.js';
import type { CultureRef } from './atlas.js';

export const NOTE_TITLE_MAX_LENGTH = 200;
export const NOTE_CONTENT_MAX_LENGTH = 10_000;

export const NOTE_EXPORT_FORMATS = ['md', 'pdf'] as const;
export type NoteExportFormat = (typeof NOTE_EXPORT_FORMATS)[number];

export interface NoteCardRef {
  id: string;
  slug: string;
  title: string;
  type: CardType;
}

/**
 * A private note (F-07). A card note always carries the card's culture too, so it is listed
 * in the culture panel and survives the deletion of the card (note_target_chk).
 */
export interface Note {
  id: string;
  title: string | null;
  /** Markdown written by the user */
  content: string;
  createdAt: string;
  updatedAt: string;
  card: NoteCardRef | null;
  culture: CultureRef | null;
}

export interface CreateNoteInput {
  content: string;
  title?: string;
  cardId?: string;
  cultureId?: string;
}

export interface UpdateNoteInput {
  content?: string;
  title?: string | null;
}

export interface NoteCardGroup {
  card: NoteCardRef;
  notes: Note[];
}

/** Notes of one culture: notes about the culture itself, then notes per card. */
export interface NoteCultureGroup {
  culture: CultureRef | null;
  cultureNotes: Note[];
  cards: NoteCardGroup[];
}

const byCreated = (a: Note, b: Note) => a.createdAt.localeCompare(b.createdAt);

/**
 * Groups notes culture -> card (BR-19), shared by the notebook page and the MD/PDF export.
 * Cultures and cards are sorted by name, notes inside a group chronologically.
 */
export function groupNotes(notes: readonly Note[], locale = 'ru'): NoteCultureGroup[] {
  const groups = new Map<string, NoteCultureGroup>();
  const cardGroups = new Map<string, NoteCardGroup>();

  for (const note of notes) {
    const cultureKey = note.culture?.id ?? '';
    let group = groups.get(cultureKey);
    if (!group) {
      group = { culture: note.culture, cultureNotes: [], cards: [] };
      groups.set(cultureKey, group);
    }
    if (!note.card) {
      group.cultureNotes.push(note);
      continue;
    }
    let cardGroup = cardGroups.get(note.card.id);
    if (!cardGroup) {
      cardGroup = { card: note.card, notes: [] };
      cardGroups.set(note.card.id, cardGroup);
      group.cards.push(cardGroup);
    }
    cardGroup.notes.push(note);
  }

  const byName = (a: string, b: string) => a.localeCompare(b, locale);
  const result = [...groups.values()];
  for (const group of result) {
    group.cultureNotes.sort(byCreated);
    group.cards.sort((a, b) => byName(a.card.title, b.card.title));
    for (const cardGroup of group.cards) cardGroup.notes.sort(byCreated);
  }
  // A note without a culture is only possible after manual DB edits; keep it last.
  return result.sort((a, b) =>
    a.culture && b.culture ? byName(a.culture.name, b.culture.name) : a.culture ? -1 : 1,
  );
}
