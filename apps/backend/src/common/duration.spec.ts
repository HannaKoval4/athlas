import { parseDuration } from './duration';

describe('parseDuration', () => {
  it.each([
    ['500ms', 500],
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
    [' 15m ', 900_000],
  ])('parses %p as %i ms', (value, expected) => {
    expect(parseDuration(value)).toBe(expected);
  });

  it.each(['', '15', 'm', '15 m', '-5m', '1.5h', '10w', '0s'])('rejects %p', (value) => {
    expect(() => parseDuration(value)).toThrow('Invalid duration');
  });
});
