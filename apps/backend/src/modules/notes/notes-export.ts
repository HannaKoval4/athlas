import path from 'node:path';
import type { AppLocale, Note, NoteCultureGroup } from '@atlas/shared';
import PDFDocument from 'pdfkit';

/** Headings of the exported file; note texts themselves are exported as written. */
const LABELS = {
  ru: {
    title: 'Мои заметки – Интерактивный атлас',
    exported: 'Экспортировано',
    count: 'Заметок',
    empty: 'Заметок пока нет.',
    aboutCulture: 'О культуре',
    card: 'Карточка',
    untitled: 'Без названия',
    created: 'Создано',
    noCulture: 'Без культуры',
  },
  en: {
    title: 'My notes – Interactive atlas',
    exported: 'Exported',
    count: 'Notes',
    empty: 'No notes yet.',
    aboutCulture: 'About the culture',
    card: 'Card',
    untitled: 'Untitled',
    created: 'Created',
    noCulture: 'No culture',
  },
} as const;

export interface ExportOptions {
  lang: AppLocale;
  exportedAt: Date;
}

/** Dates are exported as YYYY-MM-DD (UTC): unambiguous in both languages. */
const day = (iso: string): string => iso.slice(0, 10);

function countNotes(groups: readonly NoteCultureGroup[]): number {
  return groups.reduce(
    (sum, group) =>
      sum + group.cultureNotes.length + group.cards.reduce((n, card) => n + card.notes.length, 0),
    0,
  );
}

/** One file name per day, e.g. atlas-notes-2026-10-07.md */
export function exportFileName(format: 'md' | 'pdf', exportedAt: Date): string {
  return `atlas-notes-${day(exportedAt.toISOString())}.${format}`;
}

/**
 * Markdown export (F-08, BR-19): # title, ## culture, ### "about the culture" / card,
 * #### note title with its creation date, then the note text unchanged (it is Markdown already).
 */
export function renderMarkdown(
  groups: readonly NoteCultureGroup[],
  options: ExportOptions,
): string {
  const l = LABELS[options.lang];
  const lines: string[] = [
    `# ${l.title}`,
    '',
    `${l.exported}: ${day(options.exportedAt.toISOString())} · ${l.count}: ${countNotes(groups)}`,
    '',
  ];
  if (groups.length === 0) lines.push(l.empty, '');

  const pushNote = (note: Note) => {
    lines.push(`#### ${note.title ?? l.untitled}`, '', `_${l.created}: ${day(note.createdAt)}_`);
    lines.push('', note.content, '');
  };

  for (const group of groups) {
    lines.push(`## ${group.culture?.name ?? l.noCulture}`, '');
    if (group.cultureNotes.length > 0) {
      lines.push(`### ${l.aboutCulture}`, '');
      group.cultureNotes.forEach(pushNote);
    }
    for (const { card, notes } of group.cards) {
      lines.push(`### ${l.card}: ${card.title}`, '');
      notes.forEach(pushNote);
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

// DejaVu Sans covers Cyrillic; the standard PDF fonts (Helvetica...) do not (BR-19).
const FONT_DIR = path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONT_REGULAR = path.join(FONT_DIR, 'DejaVuSans.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'DejaVuSans-Bold.ttf');
const MUTED = '#57534e';

/**
 * PDF export with the same structure as the Markdown file. Note texts are printed as plain
 * text (Markdown markup stays visible): enough for reading and printing, no Markdown renderer.
 */
export function renderPdf(
  groups: readonly NoteCultureGroup[],
  options: ExportOptions,
): Promise<Buffer> {
  const l = LABELS[options.lang];
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: { Title: l.title, CreationDate: options.exportedAt },
  });
  doc.registerFont('regular', FONT_REGULAR);
  doc.registerFont('bold', FONT_BOLD);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('bold').fontSize(18).fillColor('black').text(l.title);
  doc
    .font('regular')
    .fontSize(10)
    .fillColor(MUTED)
    .text(
      `${l.exported}: ${day(options.exportedAt.toISOString())} · ${l.count}: ${countNotes(groups)}`,
    );
  doc.moveDown();
  if (groups.length === 0) doc.fontSize(12).fillColor('black').text(l.empty);

  const heading = (text: string, size: number) => {
    doc.moveDown(0.5).font('bold').fontSize(size).fillColor('black').text(text);
    doc.moveDown(0.3);
  };
  const printNote = (note: Note) => {
    doc
      .font('bold')
      .fontSize(11)
      .fillColor('black')
      .text(note.title ?? l.untitled);
    doc
      .font('regular')
      .fontSize(9)
      .fillColor(MUTED)
      .text(`${l.created}: ${day(note.createdAt)}`);
    doc.font('regular').fontSize(11).fillColor('black').text(note.content);
    doc.moveDown(0.8);
  };

  for (const group of groups) {
    heading(group.culture?.name ?? l.noCulture, 15);
    if (group.cultureNotes.length > 0) {
      heading(l.aboutCulture, 12);
      group.cultureNotes.forEach(printNote);
    }
    for (const { card, notes } of group.cards) {
      heading(`${l.card}: ${card.title}`, 12);
      notes.forEach(printNote);
    }
  }

  doc.end();
  return done;
}
