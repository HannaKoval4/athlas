import { extractSearchWords } from './ts-query';

describe('extractSearchWords', () => {
  it('lower-cases and splits into words', () => {
    expect(extractSearchWords('Храм  Афины')).toEqual(['храм', 'афины']);
  });

  it('drops tsquery syntax so the input cannot break to_tsquery', () => {
    expect(extractSearchWords(`a & b | !(c) 'd':* <-> e`)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(extractSearchWords('!!! & |')).toEqual([]);
  });

  it('keeps digits and words with ё', () => {
    expect(extractSearchWords('ёлка 365 дней')).toEqual(['ёлка', '365', 'дней']);
  });

  it('skips one-letter words unless nothing else is left', () => {
    expect(extractSearchWords('Исида и Осирис')).toEqual(['исида', 'осирис']);
    expect(extractSearchWords('и')).toEqual(['и']);
  });

  it('uses at most 8 words', () => {
    expect(extractSearchWords('w1 w2 w3 w4 w5 w6 w7 w8 w9 w10')).toHaveLength(8);
  });
});
