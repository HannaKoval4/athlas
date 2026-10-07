import type { CreateNoteInput } from '@atlas/shared';
import { Plus } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '../components/ui/button.tsx';
import { useCreateNote, useNotes } from './api.ts';
import { NoteEditor } from './NoteEditor.tsx';
import { NoteItem } from './NoteItem.tsx';

type NotesTarget = { cardId: string } | { cultureId: string };

interface NotesPanelProps {
  target: NotesTarget;
  title: string;
}

/**
 * Context notes (F-07) of a card or a culture: the list and the "Add a note" form.
 * A culture panel also lists the notes on the culture's cards, with links to them.
 */
export function NotesPanel({ target, title }: NotesPanelProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const notes = useNotes(target);
  const create = useCreateNote();
  const [adding, setAdding] = useState(false);
  const isCulture = 'cultureId' in target;

  function close() {
    create.reset();
    setAdding(false);
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3" data-testid="notes-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          {title}
        </h2>
        <Link to="/notes" className="text-sm underline underline-offset-2">
          {t('notes.allNotes')}
        </Link>
      </div>

      {adding ? (
        <div className="rounded-lg border bg-card p-3">
          <NoteEditor
            pending={create.isPending}
            error={create.isError ? t('notes.saveError') : undefined}
            onCancel={close}
            onSubmit={(values) => {
              const input: CreateNoteInput = { ...target, content: values.content };
              if (values.title) input.title = values.title;
              create.mutate(input, { onSuccess: close });
            }}
          />
        </div>
      ) : (
        <Button
          variant="outline"
          className="self-start"
          data-testid="note-add"
          onClick={() => setAdding(true)}
        >
          <Plus />
          {t('notes.add')}
        </Button>
      )}

      {notes.isPending ? (
        <p className="text-sm text-muted-foreground">{t('app.loading')}</p>
      ) : notes.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('notes.loadError')}
        </p>
      ) : notes.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="notes-empty">
          {t('notes.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="notes-list">
          {notes.data.map((note) => (
            <NoteItem key={note.id} note={note} showCard={isCulture} />
          ))}
        </ul>
      )}
    </section>
  );
}
