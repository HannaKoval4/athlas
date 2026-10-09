import { Prisma } from '../../generated/prisma/client';

/** At most this many words of the query are used; longer queries rarely match anything. */
const MAX_TERMS = 8;

/**
 * Words of the user's query: letters and digits only, lower case. Anything else is dropped,
 * so the input can never inject tsquery syntax (&, |, !, parentheses, quotes) – to_tsquery
 * rejects such input with an error. One-letter words (mostly conjunctions) are skipped
 * unless the query has nothing else.
 */
export function extractSearchWords(input: string): string[] {
  const words = input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const meaningful = words.filter((word) => word.length > 1);
  return (meaningful.length > 0 ? meaningful : words).slice(0, MAX_TERMS);
}

/**
 * tsquery for search-as-you-type; all words are required, each word matches if
 * - the word is the beginning of a stored lexeme: 'simple' keeps it unstemmed, so
 *   "пирам" finds the stem "пирамид" ("пирамиды"); or
 * - its Russian stem matches exactly: "пирамиды" -> "пирамид".
 * Stemming the prefix itself would be wrong: "пирам" stems to "пир" and "пир":* also
 * matches "пир" (a feast).
 */
export function buildTsQuery(words: readonly string[]): Prisma.Sql {
  return Prisma.join(
    words.map(
      (word) =>
        Prisma.sql`(to_tsquery('simple', ${`${word}:*`}) || plainto_tsquery('russian', ${word}))`,
    ),
    ' && ',
  );
}
