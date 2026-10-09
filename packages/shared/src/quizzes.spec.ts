import { eraStudiedCode, isExactMatch, isPassed } from './quizzes.js';

describe('isPassed (BR-11)', () => {
  it.each([
    [7, 10, 70, true], // exactly the pass mark
    [6, 10, 70, false],
    [10, 10, 70, true],
    [0, 10, 70, false],
    [5, 7, 70, true], // 71.4 %
    [4, 6, 70, false], // 66.7 %: a small pool (fewer questions than per attempt)
    [0, 0, 70, false],
  ])('%d of %d with %d %% to pass: %s', (score, total, passPercent, expected) => {
    expect(isPassed(score, total, passPercent)).toBe(expected);
  });
});

describe('isExactMatch (BR-10)', () => {
  it('accepts the same set in any order', () => {
    expect(isExactMatch(['b', 'a'], ['a', 'b'])).toBe(true);
  });

  it.each([
    ['a subset', ['a'], ['a', 'b']],
    ['a superset', ['a', 'b', 'c'], ['a', 'b']],
    ['another option', ['c'], ['a']],
    ['nothing', [], ['a']],
  ])('rejects %s', (_name, selected, correct) => {
    expect(isExactMatch(selected, correct)).toBe(false);
  });

  it('ignores a repeated option', () => {
    expect(isExactMatch(['a', 'a'], ['a'])).toBe(true);
  });
});

describe('eraStudiedCode', () => {
  it('is unique per quiz', () => {
    expect(eraStudiedCode('q1')).not.toBe(eraStudiedCode('q2'));
  });
});
