import {
  assertValidYear,
  clampYear,
  formatPeriod,
  formatYear,
  isValidYear,
  isYearInPeriod,
  middleYear,
  ordinalToYear,
  yearToOrdinal,
} from './year.js';

const NBSP = '\u00a0';

describe('isValidYear', () => {
  it.each([-3500, -527, -1, 1, 476, 2026])('accepts non-zero integer %i', (year) => {
    expect(isValidYear(year)).toBe(true);
  });

  it('rejects year 0 (there is no year 0 between 1 BCE and 1 CE)', () => {
    expect(isValidYear(0)).toBe(false);
  });

  it.each([1.5, -0.1, Number.NaN, Number.POSITIVE_INFINITY])('rejects non-integer %p', (year) => {
    expect(isValidYear(year)).toBe(false);
  });
});

describe('assertValidYear', () => {
  it('throws RangeError for year 0', () => {
    expect(() => assertValidYear(0)).toThrow(RangeError);
  });

  it('does not throw for a valid year', () => {
    expect(() => assertValidYear(-1)).not.toThrow();
  });
});

describe('formatYear', () => {
  describe('ru (default locale)', () => {
    it('formats BCE year', () => {
      expect(formatYear(-527)).toBe(`527${NBSP}г. до${NBSP}н.${NBSP}э.`);
    });

    it('formats CE year', () => {
      expect(formatYear(476, 'ru')).toBe(`476${NBSP}г. н.${NBSP}э.`);
    });
  });

  describe('en', () => {
    it.each([
      [-527, '527 BCE'],
      [-1, '1 BCE'],
      [1, '1 CE'],
      [1066, '1066 CE'],
    ])('formats %i as "%s"', (year, expected) => {
      expect(formatYear(year, 'en')).toBe(expected);
    });
  });

  it('treats -1 and 1 as adjacent boundary years with different eras', () => {
    expect(formatYear(-1, 'en')).not.toBe(formatYear(1, 'en'));
  });

  it('throws for year 0', () => {
    expect(() => formatYear(0)).toThrow(RangeError);
  });
});

describe('yearToOrdinal / ordinalToYear (no year 0)', () => {
  it.each([
    [-2, -2],
    [-1, -1],
    [1, 0],
    [2, 1],
    [476, 475],
  ])('year %i <-> ordinal %i', (year, ordinal) => {
    expect(yearToOrdinal(year)).toBe(ordinal);
    expect(ordinalToYear(ordinal)).toBe(year);
  });

  it('1 BCE and 1 CE are neighbours on the ordinal line', () => {
    expect(yearToOrdinal(1) - yearToOrdinal(-1)).toBe(1);
  });

  it('never produces year 0 for any ordinal', () => {
    for (let ordinal = -5; ordinal <= 5; ordinal += 1) {
      expect(ordinalToYear(ordinal)).not.toBe(0);
    }
  });

  it('rejects year 0 and non-integer ordinals', () => {
    expect(() => yearToOrdinal(0)).toThrow(RangeError);
    expect(() => ordinalToYear(0.5)).toThrow(RangeError);
  });
});

describe('isYearInPeriod (DM-03)', () => {
  it.each([
    [-500, true],
    [-450, true],
    [-400, true],
    [-501, false],
    [-399, false],
  ])('year %i in [-500, -400] -> %p', (year, expected) => {
    expect(isYearInPeriod(year, -500, -400)).toBe(expected);
  });
});

describe('clampYear', () => {
  it.each([
    [-3600, -3500],
    [-2000, -2000],
    [-1000, -1201],
  ])('clamps %i into [-3500, -1201] -> %i', (year, expected) => {
    expect(clampYear(year, -3500, -1201)).toBe(expected);
  });
});

describe('middleYear', () => {
  it('returns the middle of a BCE period', () => {
    expect(middleYear(-500, -400)).toBe(-450);
  });

  it('skips year 0 for a period that crosses the era boundary', () => {
    // Ordinals -2 .. 1 -> floor(-0.5) = -1 -> 1 BCE.
    expect(middleYear(-2, 2)).toBe(-1);
    // Ordinals -1 .. 1 -> 0 -> 1 CE.
    expect(middleYear(-1, 2)).toBe(1);
  });

  it('returns the only year of a one-year period', () => {
    expect(middleYear(476, 476)).toBe(476);
  });
});

describe('formatPeriod', () => {
  it('shows a single year when the period is one year long', () => {
    expect(formatPeriod(-490, -490)).toBe(formatYear(-490));
  });

  it('joins both ends with an en dash', () => {
    expect(formatPeriod(-447, -432, 'en')).toBe('447 BCE – 432 BCE');
  });

  it('crosses the era boundary', () => {
    expect(formatPeriod(-30, 14, 'en')).toBe('30 BCE – 14 CE');
  });
});
