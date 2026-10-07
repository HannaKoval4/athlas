import { CardType } from './enums.js';
import { type Note, groupNotes } from './notes.js';

const greece = { id: 'c-gr', slug: 'greece', name: 'Древняя Греция', color: '#1d4ed8' };
const egypt = { id: 'c-eg', slug: 'egypt', name: 'Древний Египет', color: '#b45309' };
const parthenon = { id: 'k-1', slug: 'parthenon', title: 'Парфенон', type: CardType.ARTWORK };
const athena = { id: 'k-2', slug: 'athena', title: 'Афина', type: CardType.MYTHOLOGY };

let sequence = 0;
function note(partial: Partial<Note>): Note {
  sequence += 1;
  return {
    id: `n-${sequence}`,
    title: null,
    content: `note ${sequence}`,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    card: null,
    culture: greece,
    ...partial,
  };
}

describe('groupNotes', () => {
  it('returns no groups for no notes', () => {
    expect(groupNotes([])).toEqual([]);
  });

  it('groups culture -> card, cultures and cards sorted by name', () => {
    const groups = groupNotes([
      note({ card: parthenon }),
      note({ culture: egypt }),
      note({ card: athena }),
      note({}),
    ]);

    expect(groups.map((g) => g.culture?.name)).toEqual(['Древний Египет', 'Древняя Греция']);
    const [egyptGroup, greeceGroup] = groups;
    expect(egyptGroup?.cultureNotes).toHaveLength(1);
    expect(egyptGroup?.cards).toEqual([]);
    expect(greeceGroup?.cultureNotes).toHaveLength(1);
    expect(greeceGroup?.cards.map((c) => c.card.title)).toEqual(['Афина', 'Парфенон']);
  });

  it('puts several notes of one card into one group, oldest first', () => {
    const later = note({ card: parthenon, createdAt: '2026-10-05T00:00:00.000Z' });
    const earlier = note({ card: parthenon, createdAt: '2026-10-02T00:00:00.000Z' });

    const [group] = groupNotes([later, earlier]);

    expect(group?.cards).toHaveLength(1);
    expect(group?.cards[0]?.notes.map((n) => n.id)).toEqual([earlier.id, later.id]);
  });

  it('keeps a note without a culture in a last group', () => {
    const orphan = note({ culture: null, card: athena });

    const groups = groupNotes([orphan, note({ culture: egypt })]);

    expect(groups.map((g) => g.culture?.slug ?? null)).toEqual(['egypt', null]);
  });
});
