import { pickTopic, type TopicCandidate } from './pick-topic';

function candidate(slug: string, overrides: Partial<TopicCandidate> = {}): TopicCandidate {
  return {
    era: { id: 'e1', slug: 'antiquity', name: 'Античность' },
    culture: { id: slug, slug, name: slug, color: '#000000' },
    fromYear: -800,
    toYear: -146,
    cardsCount: 3,
    hasQuiz: false,
    quizPassed: false,
    ...overrides,
  };
}

describe('pickTopic (BR-08)', () => {
  it('returns null when no pair has cards', () => {
    expect(pickTopic([])).toBeNull();
  });

  it('chooses by the random number', () => {
    const pairs = [candidate('a'), candidate('b'), candidate('c')];

    expect(pickTopic(pairs, () => 0)?.culture.slug).toBe('a');
    expect(pickTopic(pairs, () => 0.5)?.culture.slug).toBe('b');
    expect(pickTopic(pairs, () => 0.999)?.culture.slug).toBe('c');
  });

  it('prefers pairs whose quiz is not passed', () => {
    const pairs = [
      candidate('passed', { hasQuiz: true, quizPassed: true }),
      candidate('open', { hasQuiz: true }),
    ];

    for (const value of [0, 0.3, 0.6, 0.99]) {
      expect(pickTopic(pairs, () => value)).toMatchObject({
        culture: { slug: 'open' },
        quizStatus: 'NOT_PASSED',
        allQuizzesPassed: false,
      });
    }
  });

  it('chooses among all pairs when every quiz is passed', () => {
    const pairs = [
      candidate('a', { hasQuiz: true, quizPassed: true }),
      candidate('b', { hasQuiz: true, quizPassed: true }),
    ];

    expect(pickTopic(pairs, () => 0.9)).toMatchObject({
      culture: { slug: 'b' },
      quizStatus: 'PASSED',
      allQuizzesPassed: true,
    });
  });

  it('reports a pair without a quiz', () => {
    expect(pickTopic([candidate('a')], () => 0)).toMatchObject({
      quizStatus: 'NONE',
      cardsCount: 3,
    });
  });

  it('opens the map in the middle of the period intersection (no year 0)', () => {
    expect(pickTopic([candidate('a', { fromYear: -800, toYear: -146 })])?.year).toBe(-473);
    expect(pickTopic([candidate('a', { fromYear: -1, toYear: 2 })])?.year).toBe(1);
  });
});
