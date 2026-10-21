import {
  cardDayIssue,
  holidayDateIssue,
  isRegionGeometry,
  periodIssue,
  questionOptionsIssue,
  slugify,
} from './admin.js';

describe('periodIssue (DM-01, DM-02)', () => {
  it.each([
    [-500, -400, null],
    [-1, 1, null],
    [-450, -450, null],
    [-400, -500, 'endBeforeStart'],
    [0, 10, 'yearZero'],
    [-10, 0, 'yearZero'],
    [-20000, 10, 'yearOutOfRange'],
    [1.5, 10, 'yearOutOfRange'],
  ])('%p..%p -> %p', (start, end, expected) => {
    expect(periodIssue(start, end)).toBe(expected);
  });
});

describe('cardDayIssue', () => {
  it('accepts no day and a real day, including 29 February', () => {
    expect(cardDayIssue(null, null)).toBeNull();
    expect(cardDayIssue(2, 29)).toBeNull();
  });

  it('rejects half a date and a non-existent day', () => {
    expect(cardDayIssue(3, null)).toBe('dayIncomplete');
    expect(cardDayIssue(null, 3)).toBe('dayIncomplete');
    expect(cardDayIssue(4, 31)).toBe('dayInvalid');
    expect(cardDayIssue(13, 1)).toBe('dayInvalid');
  });
});

describe('holidayDateIssue (DM-05)', () => {
  const none = { month: null, day: null, season: null };

  it('EXACT needs a real day and no season', () => {
    expect(holidayDateIssue({ ...none, dateType: 'EXACT', month: 3, day: 21 })).toBeNull();
    expect(holidayDateIssue({ ...none, dateType: 'EXACT' })).toBe('exactNeedsDay');
    expect(holidayDateIssue({ ...none, dateType: 'EXACT', month: 2, day: 30 })).toBe('dayInvalid');
    expect(holidayDateIssue({ dateType: 'EXACT', month: 3, day: 21, season: 'SPRING' })).toBe(
      'seasonOnlyForSeason',
    );
  });

  it('SEASON needs a season and no day', () => {
    expect(holidayDateIssue({ ...none, dateType: 'SEASON', season: 'WINTER' })).toBeNull();
    expect(holidayDateIssue({ ...none, dateType: 'SEASON' })).toBe('seasonNeedsSeason');
    expect(holidayDateIssue({ dateType: 'SEASON', month: 1, day: 1, season: 'WINTER' })).toBe(
      'dayOnlyForExact',
    );
  });

  it('MOVABLE and APPROXIMATE have neither a day nor a season', () => {
    expect(holidayDateIssue({ ...none, dateType: 'MOVABLE' })).toBeNull();
    expect(holidayDateIssue({ ...none, dateType: 'APPROXIMATE', month: 5, day: 1 })).toBe(
      'dayOnlyForExact',
    );
    expect(holidayDateIssue({ ...none, dateType: 'MOVABLE', season: 'SUMMER' })).toBe(
      'seasonOnlyForSeason',
    );
  });
});

describe('questionOptionsIssue', () => {
  const option = (text: string, isCorrect = false) => ({ text, isCorrect });

  it('accepts a single-choice question with exactly one correct option', () => {
    expect(questionOptionsIssue(false, [option('A', true), option('B')])).toBeNull();
  });

  it('accepts several correct options for a multiple-choice question', () => {
    expect(
      questionOptionsIssue(true, [option('A', true), option('B', true), option('C')]),
    ).toBeNull();
  });

  it('rejects wrong option sets', () => {
    expect(questionOptionsIssue(false, [option('A', true)])).toBe('tooFewOptions');
    expect(
      questionOptionsIssue(
        false,
        Array.from({ length: 9 }, (_, i) => option(`${i}`, i === 0)),
      ),
    ).toBe('tooManyOptions');
    expect(questionOptionsIssue(true, [option('A'), option('B')])).toBe('noCorrectOption');
    expect(questionOptionsIssue(false, [option('A', true), option('B', true)])).toBe(
      'singleNeedsOneCorrect',
    );
    expect(questionOptionsIssue(false, [option('Зевс', true), option(' зевс ')])).toBe(
      'duplicateOption',
    );
  });
});

describe('isRegionGeometry (DM-10)', () => {
  const ring = [
    [20, 35],
    [21, 35],
    [21, 36],
    [20, 35],
  ];

  it('accepts a Polygon and a MultiPolygon', () => {
    expect(isRegionGeometry({ type: 'Polygon', coordinates: [ring] })).toBe(true);
    expect(isRegionGeometry({ type: 'MultiPolygon', coordinates: [[ring], [ring]] })).toBe(true);
  });

  it('rejects other shapes', () => {
    expect(isRegionGeometry(null)).toBe(false);
    expect(isRegionGeometry({ type: 'Point', coordinates: [20, 35] })).toBe(false);
    expect(isRegionGeometry({ type: 'Polygon', coordinates: [ring.slice(0, 3)] })).toBe(false);
    expect(isRegionGeometry({ type: 'Polygon', coordinates: [[[20, 'x'], ...ring]] })).toBe(false);
    expect(isRegionGeometry({ type: 'MultiPolygon', coordinates: [] })).toBe(false);
  });
});

describe('slugify', () => {
  it.each([
    ['Храм Зевса в Олимпии', 'khram-zevsa-v-olimpii'],
    ['Щит Ахилла', 'shchit-akhilla'],
    ['  Ёлка -- и   Ель ', 'elka-i-el'],
    ['Zeus & Hera!', 'zeus-hera'],
    ['Café', 'cafe'],
  ])('%p -> %p', (text, expected) => {
    expect(slugify(text)).toBe(expected);
  });

  it('keeps slugs within the length limit without a trailing dash', () => {
    const slug = slugify('слово '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});
