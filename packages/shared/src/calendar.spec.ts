import {
  daysInMonth,
  isRecalculatedDate,
  isValidCalendarDate,
  SEASON_MONTHS,
  seasonOfMonth,
} from './calendar.js';

describe('calendar dates', () => {
  it.each([
    [1, 31, true],
    [2, 29, true], // a yearly date may be a leap day
    [2, 30, false],
    [4, 31, false],
    [12, 31, true],
    [1, 0, false],
    [0, 1, false],
    [13, 1, false],
    [1.5, 1, false],
  ])('month %d, day %d is valid: %s', (month, day, expected) => {
    expect(isValidCalendarDate(month, day)).toBe(expected);
  });

  it('knows the length of every month', () => {
    expect(Array.from({ length: 12 }, (_, i) => daysInMonth(i + 1))).toEqual([
      31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ]);
  });
});

describe('seasonOfMonth', () => {
  it.each([
    [12, 'WINTER'],
    [1, 'WINTER'],
    [3, 'SPRING'],
    [8, 'SUMMER'],
    [11, 'AUTUMN'],
  ])('month %d is %s', (month, season) => {
    expect(seasonOfMonth(month)).toBe(season);
  });

  it('covers every month exactly once', () => {
    expect(
      Object.values(SEASON_MONTHS)
        .flat()
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('rejects an invalid month', () => {
    expect(() => seasonOfMonth(13)).toThrow(RangeError);
  });
});

describe('isRecalculatedDate (BR-15)', () => {
  it('marks days before the Gregorian reform as recalculated', () => {
    expect(isRecalculatedDate(-490)).toBe(true);
    expect(isRecalculatedDate(1581)).toBe(true);
    expect(isRecalculatedDate(1582)).toBe(false);
    expect(isRecalculatedDate(1922)).toBe(false);
  });
});
