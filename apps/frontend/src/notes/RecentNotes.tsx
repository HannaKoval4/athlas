import type { Note } from '@atlas/shared';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { Link } from 'react-router';

const RECENT_COUNT = 3;

/** Where a note leads: its card, otherwise its culture panel. */
function noteLink(note: Note): { to: string; label: string } | null {
  if (note.card) return { to: `/cards/${note.card.slug}`, label: note.card.title };
  if (note.culture) return { to: `/cultures/${note.culture.slug}`, label: note.culture.name };
  return null;
}

/** Notes block of the main screen: the latest notes with links back to their card or culture. */
export function RecentNotes({ notes }: { notes: Note[] }) {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="recent-notes-title"
      className="flex flex-col gap-2"
      data-testid="recent-notes"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="recent-notes-title" className="text-lg font-semibold">
          {t('notes.recentTitle')}
        </h2>
        <Link to="/notes" className="text-sm underline underline-offset-2">
          {t('notes.allNotes')}
        </Link>
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-stone-600">{t('notes.emptyHint')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.slice(0, RECENT_COUNT).map((note) => {
            const link = noteLink(note);
            return (
              <li key={note.id} className="flex flex-col text-sm">
                <span className="font-medium">{note.title ?? t('notes.untitled')}</span>
                {/* Preview: inline emphasis kept, blocks (lists, paragraphs) flattened into one line. */}
                <span className="line-clamp-2 text-stone-600">
                  <Markdown allowedElements={['strong', 'em', 'code']} unwrapDisallowed>
                    {note.content}
                  </Markdown>
                </span>
                {link && (
                  <Link to={link.to} className="text-xs underline underline-offset-2">
                    {link.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
