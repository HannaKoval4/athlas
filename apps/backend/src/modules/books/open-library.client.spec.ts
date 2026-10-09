import type { ConfigService } from '@nestjs/config';
import { OpenLibraryClient, toBook } from './open-library.client';

function client(env: Record<string, string> = {}) {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new OpenLibraryClient(config);
}

function answer(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('toBook', () => {
  it('maps a search result', () => {
    expect(
      toBook({
        key: '/works/OL4290372W',
        title: 'The Parthenon',
        author_name: ['Jenifer Neils'],
        first_publish_year: 2005,
        cover_i: 357500,
      }),
    ).toEqual({
      key: '/works/OL4290372W',
      title: 'The Parthenon',
      authors: ['Jenifer Neils'],
      firstPublishYear: 2005,
      coverUrl: 'https://covers.openlibrary.org/b/id/357500-M.jpg',
      url: 'https://openlibrary.org/works/OL4290372W',
    });
  });

  it('tolerates missing optional fields', () => {
    expect(toBook({ key: '/works/OL1W', title: 'Untitled' })).toMatchObject({
      authors: [],
      firstPublishYear: null,
      coverUrl: null,
    });
  });

  it('skips a result without a key or a title', () => {
    expect(toBook({ title: 'No key' })).toBeNull();
    expect(toBook({ key: '/works/OL1W' })).toBeNull();
  });
});

describe('OpenLibraryClient', () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch');

  afterEach(() => fetchMock.mockReset());
  afterAll(() => fetchMock.mockRestore());

  it('asks for 5 books with only the needed fields and identifies itself', async () => {
    fetchMock.mockResolvedValue(answer({ docs: [] }));

    await client({ OPEN_LIBRARY_CONTACT: 'atlas@example.com' }).search('Rosetta Stone');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    // The client always passes the URL as a string.
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe('https://openlibrary.org/search.json');
    expect(parsed.searchParams.get('q')).toBe('Rosetta Stone');
    expect(parsed.searchParams.get('limit')).toBe('5');
    expect(parsed.searchParams.get('fields')).toBe(
      'key,title,author_name,first_publish_year,cover_i',
    );
    expect((init?.headers as Record<string, string>)['User-Agent']).toBe(
      'HistoryAtlas/0.1 (atlas@example.com)',
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns at most 5 valid books', async () => {
    const docs = Array.from({ length: 7 }, (_, i) => ({ key: `/works/OL${i}W`, title: `B${i}` }));
    fetchMock.mockResolvedValue(answer({ docs: [{ title: 'no key' }, ...docs] }));

    const books = await client().search('Egypt');

    expect(books.map((b) => b.title)).toEqual(['B0', 'B1', 'B2', 'B3', 'B4']);
  });

  it('throws on an error answer, so the caller can degrade', async () => {
    fetchMock.mockResolvedValue(answer({}, 503));

    await expect(client().search('Egypt')).rejects.toThrow('503');
  });

  it('uses the configured base URL (a stub in tests)', async () => {
    fetchMock.mockResolvedValue(answer({ docs: [] }));

    await client({ OPEN_LIBRARY_BASE_URL: 'http://127.0.0.1:4010/' }).search('Egypt');

    expect(fetchMock.mock.calls[0]?.[0] as string).toMatch(
      /^http:\/\/127\.0\.0\.1:4010\/search\.json\?/,
    );
  });
});
