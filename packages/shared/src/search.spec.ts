import { HIGHLIGHT_END as E, HIGHLIGHT_START as S, splitHighlights } from './search.js';

describe('splitHighlights', () => {
  it('returns one plain part without marks', () => {
    expect(splitHighlights('Храм Афины')).toEqual([{ text: 'Храм Афины', highlighted: false }]);
  });

  it('splits plain and highlighted parts', () => {
    expect(splitHighlights(`Храм ${S}Афины${E} Парфенос и ${S}Афина${E}`)).toEqual([
      { text: 'Храм ', highlighted: false },
      { text: 'Афины', highlighted: true },
      { text: ' Парфенос и ', highlighted: false },
      { text: 'Афина', highlighted: true },
    ]);
  });

  it('tolerates an unclosed mark (cut snippet)', () => {
    expect(splitHighlights(`a ${S}b`)).toEqual([
      { text: 'a ', highlighted: false },
      { text: 'b', highlighted: true },
    ]);
  });

  it('returns nothing for an empty snippet', () => {
    expect(splitHighlights('')).toEqual([]);
  });
});
