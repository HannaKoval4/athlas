/** BR-16: at most this many books are shown for a card or a culture. */
export const BOOKS_LIMIT = 5;

/** A book found in Open Library ("Books on the topic", F-14). */
export interface Book {
  /** Open Library work key, e.g. "/works/OL4290372W" */
  key: string;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  /** Medium-size cover from covers.openlibrary.org; null if the book has none */
  coverUrl: string | null;
  /** The book's page on openlibrary.org */
  url: string;
}

/** Books of exactly one card or one culture. */
export type BooksQuery = { cardId: string } | { cultureId: string };
