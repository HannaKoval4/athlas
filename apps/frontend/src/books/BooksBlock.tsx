import type { Book, BooksQuery } from '@atlas/shared';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../api/client.ts';

function useBooks(query: BooksQuery) {
  const params = new URLSearchParams(query);
  return useQuery({
    queryKey: ['books', query],
    queryFn: () => apiRequest<Book[]>(`/books?${params.toString()}`),
    // The server caches answers for 7 days; within a visit one request per topic is enough.
    staleTime: 60 * 60 * 1000,
    // An unavailable catalogue is not worth retrying: the block simply stays hidden.
    retry: false,
  });
}

/**
 * "Books on the topic" (F-14) from Open Library. BR-16: the block is shown only when there
 * are books; while loading, on an error or with no results it is hidden, and the page works
 * as before.
 */
export function BooksBlock({ query }: { query: BooksQuery }) {
  const { t } = useTranslation();
  const books = useBooks(query);

  if (!books.data || books.data.length === 0) return null;

  return (
    <section aria-labelledby="books-title" className="flex flex-col gap-3" data-testid="books">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="books-title" className="text-lg font-semibold">
          {t('books.title')}
        </h2>
        <a
          href="https://openlibrary.org"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          {t('books.source')}
        </a>
      </div>
      <ul className="flex flex-col gap-3">
        {books.data.map((book) => (
          <li key={book.key} className="flex gap-3" data-testid="book">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt=""
                loading="lazy"
                className="h-16 w-11 shrink-0 rounded-sm bg-muted object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-16 w-11 shrink-0 items-center justify-center rounded-sm bg-muted"
              >
                <BookOpen className="size-4 text-muted-foreground" />
              </span>
            )}
            <div className="flex min-w-0 flex-col text-sm">
              <a
                href={book.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-1 font-medium underline-offset-2 hover:underline"
              >
                {book.title}
                <ExternalLink className="mt-1 size-3 shrink-0" aria-label={t('books.external')} />
              </a>
              {book.authors.length > 0 && (
                <span className="text-muted-foreground">{book.authors.join(', ')}</span>
              )}
              {book.firstPublishYear !== null && (
                <span className="text-xs text-muted-foreground">
                  {t('books.firstPublished', { year: book.firstPublishYear })}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('books.hint')}</p>
    </section>
  );
}
