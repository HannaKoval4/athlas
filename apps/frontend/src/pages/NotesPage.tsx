import { groupNotes } from '@atlas/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageContainer } from '../components/AppLayout.tsx';
import { useNotes } from '../notes/api.ts';
import { ExportNotes } from '../notes/ExportNotes.tsx';
import { NoteItem } from '../notes/NoteItem.tsx';

/** /notes — the notebook: every note of the user, grouped culture -> card like the export. */
export function NotesPage() {
  const { t, i18n } = useTranslation();
  const notes = useNotes({});

  return (
    <PageContainer>
      <div className="flex flex-col gap-6" data-testid="notes-page">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{t('notes.title')}</h1>
          <p className="text-muted-foreground">{t('notes.intro')}</p>
        </header>

        <section aria-labelledby="export-title" className="flex flex-col gap-2">
          <h2 id="export-title" className="text-lg font-semibold">
            {t('notes.exportTitle')}
          </h2>
          <ExportNotes />
        </section>

        {notes.isPending ? (
          <p role="status">{t('app.loading')}</p>
        ) : notes.isError ? (
          <p role="alert">{t('notes.loadError')}</p>
        ) : notes.data.length === 0 ? (
          <div className="flex flex-col gap-1" data-testid="notes-empty">
            <p>{t('notes.empty')}</p>
            <p className="text-muted-foreground">{t('notes.emptyHint')}</p>
          </div>
        ) : (
          groupNotes(notes.data, i18n.language).map((group) => (
            <section
              key={group.culture?.id ?? 'none'}
              aria-labelledby={`culture-${group.culture?.id ?? 'none'}`}
              className="flex flex-col gap-4"
              data-testid="notes-culture-group"
            >
              <h2
                id={`culture-${group.culture?.id ?? 'none'}`}
                className="flex items-center gap-2 border-b pb-1 text-xl font-semibold"
              >
                {group.culture && (
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-full"
                    style={{ backgroundColor: group.culture.color }}
                  />
                )}
                {group.culture ? (
                  <Link to={`/cultures/${group.culture.slug}`} className="hover:underline">
                    {group.culture.name}
                  </Link>
                ) : (
                  t('notes.noCulture')
                )}
              </h2>
              {group.cultureNotes.length > 0 && (
                <NoteGroup title={t('notes.aboutCulture')}>
                  {group.cultureNotes.map((note) => (
                    <NoteItem key={note.id} note={note} />
                  ))}
                </NoteGroup>
              )}
              {group.cards.map(({ card, notes: cardNotes }) => (
                <NoteGroup
                  key={card.id}
                  title={
                    <>
                      {t('notes.card')}:{' '}
                      <Link to={`/cards/${card.slug}`} className="underline underline-offset-2">
                        {card.title}
                      </Link>
                    </>
                  }
                >
                  {cardNotes.map((note) => (
                    <NoteItem key={note.id} note={note} />
                  ))}
                </NoteGroup>
              ))}
            </section>
          ))
        )}
      </div>
    </PageContainer>
  );
}

function NoteGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}
