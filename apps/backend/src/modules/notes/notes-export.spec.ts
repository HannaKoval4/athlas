import { CardType, type Note, groupNotes } from '@atlas/shared';
import { exportFileName, renderMarkdown, renderPdf } from './notes-export';

const greece = { id: 'c-gr', slug: 'greece', name: 'Древняя Греция', color: '#1d4ed8' };
const parthenon = { id: 'k-1', slug: 'parthenon', title: 'Парфенон', type: CardType.ARTWORK };
const exportedAt = new Date('2026-10-07T12:00:00.000Z');

const notes: Note[] = [
  {
    id: 'n-1',
    title: 'Ордер',
    content: 'Дорический **ордер**.',
    createdAt: '2026-10-03T09:00:00.000Z',
    updatedAt: '2026-10-03T09:00:00.000Z',
    card: parthenon,
    culture: greece,
  },
  {
    id: 'n-2',
    title: null,
    content: 'Полисы и колонии.',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    card: null,
    culture: greece,
  },
];

describe('renderMarkdown', () => {
  it('builds culture -> about the culture / card -> note with creation dates (BR-19)', () => {
    const md = renderMarkdown(groupNotes(notes), { lang: 'ru', exportedAt });

    expect(md).toBe(
      [
        '# Мои заметки — Интерактивный атлас',
        '',
        'Экспортировано: 2026-10-07 · Заметок: 2',
        '',
        '## Древняя Греция',
        '',
        '### О культуре',
        '',
        '#### Без названия',
        '',
        '_Создано: 2026-10-01_',
        '',
        'Полисы и колонии.',
        '',
        '### Карточка: Парфенон',
        '',
        '#### Ордер',
        '',
        '_Создано: 2026-10-03_',
        '',
        'Дорический **ордер**.',
        '',
      ].join('\n'),
    );
  });

  it('says that there are no notes', () => {
    const md = renderMarkdown([], { lang: 'ru', exportedAt });

    expect(md).toContain('Заметок: 0');
    expect(md).toContain('Заметок пока нет.');
  });

  it('uses English headings for lang=en; note texts stay as written', () => {
    const md = renderMarkdown(groupNotes(notes), { lang: 'en', exportedAt });

    expect(md).toContain('# My notes — Interactive atlas');
    expect(md).toContain('### Card: Парфенон');
    expect(md).toContain('#### Untitled');
  });
});

describe('renderPdf', () => {
  it('produces a PDF with an embedded Cyrillic font (BR-19)', async () => {
    const pdf = await renderPdf(groupNotes(notes), { lang: 'ru', exportedAt });

    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // Font names are stored uncompressed; standard Helvetica has no Cyrillic glyphs.
    expect(pdf.toString('latin1')).toContain('DejaVuSans');
  });
});

describe('exportFileName', () => {
  it('names the file by the export date', () => {
    expect(exportFileName('pdf', exportedAt)).toBe('atlas-notes-2026-10-07.pdf');
  });
});
