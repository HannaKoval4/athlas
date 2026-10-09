import { type Book, BOOKS_LIMIT } from '@atlas/shared';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** BR-16: the external API must not hold up the page. */
export const OPEN_LIBRARY_TIMEOUT_MS = 5000;
const DEFAULT_BASE_URL = 'https://openlibrary.org';
const COVERS_URL = 'https://covers.openlibrary.org/b/id';
/** Only the fields the block shows (smaller and faster answers). */
const FIELDS = 'key,title,author_name,first_publish_year,cover_i';

interface SearchDoc {
  key?: unknown;
  title?: unknown;
  author_name?: unknown;
  first_publish_year?: unknown;
  cover_i?: unknown;
}

/** Turns one search result into a Book; results without a key or a title are skipped. */
export function toBook(doc: SearchDoc, siteUrl: string = DEFAULT_BASE_URL): Book | null {
  if (typeof doc.key !== 'string' || typeof doc.title !== 'string') return null;
  const authors = Array.isArray(doc.author_name)
    ? doc.author_name.filter((name): name is string => typeof name === 'string')
    : [];
  return {
    key: doc.key,
    title: doc.title,
    authors,
    firstPublishYear: typeof doc.first_publish_year === 'number' ? doc.first_publish_year : null,
    // Covers by cover id are not rate-limited (unlike covers by ISBN).
    coverUrl: typeof doc.cover_i === 'number' ? `${COVERS_URL}/${doc.cover_i}-M.jpg` : null,
    url: `${siteUrl}${doc.key}`,
  };
}

/**
 * Open Library search API (https://openlibrary.org/dev/docs/api/search), called only from the
 * backend. The User-Agent names the application and a contact, as Open Library asks; identified
 * clients get a higher rate limit. Throws on a timeout, a network error or a non-2xx answer;
 * the caller decides how to degrade.
 */
@Injectable()
export class OpenLibraryClient {
  private readonly logger = new Logger(OpenLibraryClient.name);
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('OPEN_LIBRARY_BASE_URL') ?? DEFAULT_BASE_URL).replace(
      /\/+$/,
      '',
    );
    const contact = config.get<string>('OPEN_LIBRARY_CONTACT');
    this.userAgent = `HistoryAtlas/0.1${contact ? ` (${contact})` : ''}`;
  }

  async search(query: string): Promise<Book[]> {
    const params = new URLSearchParams({ q: query, fields: FIELDS, limit: String(BOOKS_LIMIT) });
    const started = Date.now();
    const response = await fetch(`${this.baseUrl}/search.json?${params.toString()}`, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(OPEN_LIBRARY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Open Library answered ${response.status}`);
    const body = (await response.json()) as { docs?: unknown };
    this.logger.debug(`"${query}" fetched in ${Date.now() - started} ms`);

    const docs = Array.isArray(body.docs) ? (body.docs as SearchDoc[]) : [];
    return docs
      .map((doc) => toBook(doc))
      .filter((book): book is Book => book !== null)
      .slice(0, BOOKS_LIMIT);
  }
}
