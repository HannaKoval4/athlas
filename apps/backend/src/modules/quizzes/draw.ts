/** Fisher–Yates shuffle into a new array; `random` returns [0, 1) like Math.random. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(random() * (i + 1)), i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** BR-09: `count` random questions of the pool, or the whole pool when it is smaller. */
export function drawQuestions<T>(pool: readonly T[], count: number, random?: () => number): T[] {
  return shuffle(pool, random).slice(0, Math.min(count, pool.length));
}
