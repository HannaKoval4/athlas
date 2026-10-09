import { CardType } from '../../src/generated/prisma/enums';
import { loadSeedData } from './load';
import type { SeedCard, SeedData, SeedQuestion } from './types';
import { collectVerifyNotes, MIN_QUIZ_POOL, validateSeedData } from './validate';

function card(slug: string, type: CardType, overrides: Partial<SeedCard> = {}): SeedCard {
  return {
    slug,
    type,
    title: `Title ${slug}`,
    summary: 'Summary',
    content: ['Paragraph'],
    startYear: -500,
    endYear: -400,
    sources: ['src'],
    ...overrides,
  };
}

/** Smallest dataset that satisfies every rule; each test breaks exactly one thing. */
function validData(): SeedData {
  return {
    eras: [
      { slug: 'era-a', name: 'A', startYear: -3000, endYear: -1201, sortOrder: 1 },
      { slug: 'era-b', name: 'B', startYear: -1200, endYear: 476, sortOrder: 2 },
    ],
    regions: [
      {
        slug: 'reg',
        name: 'Region',
        centerLat: 30,
        centerLng: 31,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [30, 30],
              [31, 30],
              [31, 31],
              [30, 31],
              [30, 30],
            ],
          ],
        },
      },
    ],
    sources: [{ slug: 'src', type: 'BOOK', title: 'Book' }],
    cultures: [
      {
        slug: 'culture',
        name: 'Culture',
        description: 'Description',
        startYear: -3000,
        endYear: -30,
        color: '#C8963E',
        regions: [{ region: 'reg', startYear: -3000, endYear: -30 }],
        cards: Object.values(CardType).map((type, i) => card(`card-${i}`, type)),
        links: [{ from: 'card-0', to: 'card-1', type: 'RELATED' }],
        holidays: [
          { slug: 'h-exact', name: 'H', description: 'D', dateType: 'EXACT', month: 3, day: 1 },
          {
            slug: 'h-season',
            name: 'H',
            description: 'D',
            dateType: 'SEASON',
            season: 'SPRING',
            dateNote: 'Lunar calendar',
          },
        ],
      },
    ],
    quizzes: [
      {
        culture: 'culture',
        quizzes: [{ era: 'era-b', title: 'Quiz', questions: questions(MIN_QUIZ_POOL) }],
      },
    ],
  };
}

function questions(count: number): SeedQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `Question ${i + 1}?`,
    // card-1: the boundary-year tests move card-0 out of the culture's period.
    card: 'card-1',
    correct: ['Yes'],
    wrong: ['No'],
    explanation: 'Because.',
  }));
}

function firstQuiz(data: SeedData) {
  return data.quizzes[0].quizzes[0];
}

describe('validateSeedData', () => {
  it('accepts the real seed data of the project', () => {
    expect(validateSeedData(loadSeedData())).toEqual([]);
  });

  it('accepts the minimal valid fixture', () => {
    expect(validateSeedData(validData())).toEqual([]);
  });

  describe('years and periods (DM-01, DM-02)', () => {
    it('rejects year 0', () => {
      const data = validData();
      data.cultures[0].cards[0].startYear = 0;

      expect(validateSeedData(data)).toContainEqual(expect.stringContaining('invalid startYear 0'));
    });

    it('rejects startYear > endYear', () => {
      const data = validData();
      data.cultures[0].startYear = 100;
      data.cultures[0].endYear = -100;

      expect(validateSeedData(data)).toContainEqual(
        expect.stringContaining('startYear 100 > endYear -100'),
      );
    });

    it('accepts a one-year period at the -1/1 boundary', () => {
      const data = validData();
      data.cultures[0].cards[0].startYear = -1;
      data.cultures[0].cards[0].endYear = 1;

      expect(validateSeedData(data)).toEqual([]);
    });

    it('rejects overlapping eras', () => {
      const data = validData();
      data.eras[1].startYear = -1201;

      expect(validateSeedData(data)).toContainEqual(expect.stringContaining('overlaps'));
    });
  });

  describe('cards', () => {
    it('requires at least one source per card', () => {
      const data = validData();
      data.cultures[0].cards[0].sources = [];

      expect(validateSeedData(data)).toContainEqual('card "card-0": has no sources');
    });

    it('rejects a reference to an unknown source', () => {
      const data = validData();
      data.cultures[0].cards[0].sources = ['missing'];

      expect(validateSeedData(data)).toContainEqual('card "card-0": unknown source "missing"');
    });

    it('requires every card type to be present in a culture', () => {
      const data = validData();
      data.cultures[0].cards = data.cultures[0].cards.filter((c) => c.type !== CardType.ARTIFACT);

      expect(validateSeedData(data)).toContainEqual('culture "culture": no cards of type ARTIFACT');
    });

    it('rejects duplicate card slugs', () => {
      const data = validData();
      data.cultures[0].cards[1].slug = 'card-0';

      expect(validateSeedData(data)).toContainEqual(expect.stringContaining('duplicate slug'));
    });

    it('requires month and day together', () => {
      const data = validData();
      data.cultures[0].cards[0].month = 5;

      expect(validateSeedData(data)).toContainEqual(
        'card "card-0": month and day must be set together',
      );
    });

    it.each([
      [13, 1, 'invalid month 13'],
      [2, 32, 'invalid day 32'],
    ])('rejects month=%i day=%i', (month, day, message) => {
      const data = validData();
      Object.assign(data.cultures[0].cards[0], { month, day });

      expect(validateSeedData(data)).toContainEqual(expect.stringContaining(message));
    });
  });

  describe('card links (DM-06)', () => {
    it('rejects a self-link', () => {
      const data = validData();
      data.cultures[0].links = [{ from: 'card-0', to: 'card-0', type: 'RELATED' }];

      expect(validateSeedData(data)).toContainEqual(
        expect.stringContaining('cannot link to itself'),
      );
    });

    it('rejects a duplicate link', () => {
      const data = validData();
      data.cultures[0].links.push({ from: 'card-0', to: 'card-1', type: 'RELATED' });

      expect(validateSeedData(data)).toContainEqual(expect.stringContaining('duplicate link'));
    });

    it('rejects a link to an unknown card', () => {
      const data = validData();
      data.cultures[0].links = [{ from: 'card-0', to: 'nope', type: 'RELATED' }];

      expect(validateSeedData(data)).toContainEqual(expect.stringContaining('unknown card "nope"'));
    });
  });

  describe('holidays (DM-05)', () => {
    it('requires month and day for an EXACT holiday', () => {
      const data = validData();
      delete data.cultures[0].holidays[0].month;
      delete data.cultures[0].holidays[0].day;

      expect(validateSeedData(data)).toContainEqual(
        'holiday "h-exact": EXACT holiday needs month and day',
      );
    });

    it('requires a season for a SEASON holiday', () => {
      const data = validData();
      delete data.cultures[0].holidays[1].season;

      expect(validateSeedData(data)).toContainEqual(
        'holiday "h-season": SEASON holiday needs a season',
      );
    });

    it('requires an explanation for a non-exact date', () => {
      const data = validData();
      delete data.cultures[0].holidays[1].dateNote;

      expect(validateSeedData(data)).toContainEqual(
        expect.stringContaining('must be explained in dateNote'),
      );
    });
  });

  describe('regions and cultures', () => {
    it('rejects an open polygon ring', () => {
      const data = validData();
      data.regions[0].geometry.coordinates[0][4] = [30.5, 30.5];

      expect(validateSeedData(data)).toContainEqual(expect.stringContaining('must be closed'));
    });

    it('rejects a reference to an unknown region', () => {
      const data = validData();
      data.cultures[0].regions[0].region = 'atlantis';

      expect(validateSeedData(data)).toContainEqual(
        'culture "culture" region "atlantis": unknown region',
      );
    });

    it('rejects a malformed colour', () => {
      const data = validData();
      data.cultures[0].color = 'gold';

      expect(validateSeedData(data)).toContainEqual('culture "culture": color must be #RRGGBB');
    });
  });
});

describe('Open Library queries (BR-16)', () => {
  it('accepts an English phrase', () => {
    const data = validData();
    data.cultures[0].booksQuery = 'Ancient Egypt';
    data.cultures[0].cards[0].booksQuery = "Hatshepsut's temple";
    expect(validateSeedData(data)).toEqual([]);
  });

  it('rejects a Cyrillic phrase (the catalogue is searched in English)', () => {
    const data = validData();
    data.cultures[0].cards[0].booksQuery = 'Парфенон';
    expect(validateSeedData(data)).toContain(
      'card "card-0": booksQuery must be 2-100 Latin letters, digits or spaces',
    );
  });
});

describe('quizzes (DM-08, BR-09, BR-10)', () => {
  it('requires a pool of at least 15 questions', () => {
    const data = validData();
    firstQuiz(data).questions = questions(MIN_QUIZ_POOL - 1);
    expect(validateSeedData(data)).toContain('quiz era-b/culture: pool has 14 questions, needs 15');
  });

  it('rejects a second quiz for the same pair', () => {
    const data = validData();
    data.quizzes[0].quizzes.push({ ...firstQuiz(data) });
    expect(validateSeedData(data)).toContain('quiz era-b/culture: duplicate quiz for the pair');
  });

  it('rejects an era the culture does not reach', () => {
    const data = validData();
    data.eras.push({ slug: 'era-c', name: 'C', startYear: 477, endYear: 1100, sortOrder: 3 });
    firstQuiz(data).era = 'era-c';
    expect(validateSeedData(data)).toContain(
      'quiz era-c/culture: the culture does not overlap the era',
    );
  });

  it('requires a correct and a wrong option, without duplicates', () => {
    const data = validData();
    const [noCorrect, duplicate] = firstQuiz(data).questions;
    noCorrect.correct = [];
    duplicate.wrong = ['Yes'];
    const issues = validateSeedData(data);
    expect(issues).toContain('quiz era-b/culture question 1: no correct option');
    expect(issues).toContain('quiz era-b/culture question 2: duplicate option');
  });

  it('requires an explanation for the review of mistakes (BR-14)', () => {
    const data = validData();
    firstQuiz(data).questions[0].explanation = ' ';
    expect(validateSeedData(data)).toContain(
      'quiz era-b/culture question 1: empty explanation (BR-14)',
    );
  });

  it('rejects a card of another era', () => {
    const data = validData();
    data.cultures[0].cards[1].startYear = -2000;
    data.cultures[0].cards[1].endYear = -1900;
    expect(validateSeedData(data)).toContain(
      'quiz era-b/culture question 1: card "card-1" is outside the era',
    );
  });
});

describe('collectVerifyNotes', () => {
  it('lists every verify note with its location', () => {
    const data = validData();
    data.cultures[0].cards[0].verify = 'Check the date';
    data.sources[0].verify = 'Check the URL';

    expect(collectVerifyNotes(data)).toEqual([
      'source src: Check the URL',
      'card card-0: Check the date',
    ]);
  });
});
