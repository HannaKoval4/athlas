import type { Note } from '@atlas/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { Link } from 'react-router';
import { Button } from '../components/ui/button.tsx';
import { useDeleteNote, useUpdateNote } from './api.ts';
import { NoteEditor } from './NoteEditor.tsx';

interface NoteItemProps {
  note: Note;
  /** Show a link to the note's card (lists that mix culture and card notes). */
  showCard?: boolean;
}

/** One note with in-place editing and a two-step delete (no modal dialog needed). */
export function NoteItem({ note, showCard = false }: NoteItemProps) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>('view');
  const update = useUpdateNote();
  const remove = useDeleteNote();

  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);
  const edited = note.updatedAt.slice(0, 10) !== note.createdAt.slice(0, 10);

  if (mode === 'edit') {
    return (
      <li className="rounded-lg border bg-card p-3">
        <NoteEditor
          defaultValues={{ title: note.title ?? '', content: note.content }}
          pending={update.isPending}
          error={update.isError ? t('notes.saveError') : undefined}
          onCancel={() => {
            update.reset();
            setMode('view');
          }}
          onSubmit={(values) =>
            update.mutate(
              { id: note.id, title: values.title || null, content: values.content },
              { onSuccess: () => setMode('view') },
            )
          }
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-3" data-testid="note-item">
      <div className="flex flex-col">
        <p className="font-medium" data-testid="note-item-title">
          {note.title ?? <span className="text-muted-foreground">{t('notes.untitled')}</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('notes.created', { date: date(note.createdAt) })}
          {edited && <>, {t('notes.edited', { date: date(note.updatedAt) })}</>}
        </p>
        {showCard && note.card && (
          <Link
            to={`/cards/${note.card.slug}`}
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            {t('notes.card')}: {note.card.title}
          </Link>
        )}
      </div>
      {/* react-markdown renders no raw HTML: a note cannot inject markup. */}
      <div className="markdown text-sm" data-testid="note-item-content">
        <Markdown>{note.content}</Markdown>
      </div>
      {mode === 'confirm' ? (
        <div
          role="group"
          aria-label={t('notes.confirmDelete')}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm">{t('notes.confirmDelete')}</span>
          <Button
            size="sm"
            variant="destructive"
            disabled={remove.isPending}
            data-testid="note-delete-confirm"
            onClick={() => remove.mutate(note.id)}
          >
            {t('notes.confirmYes')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode('view')}>
            {t('notes.cancel')}
          </Button>
          {remove.isError && (
            <span role="alert" className="text-sm text-destructive">
              {t('notes.deleteError')}
            </span>
          )}
        </div>
      ) : (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" data-testid="note-edit" onClick={() => setMode('edit')}>
            <Pencil />
            {t('notes.edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="note-delete"
            onClick={() => setMode('confirm')}
          >
            <Trash2 />
            {t('notes.delete')}
          </Button>
        </div>
      )}
    </li>
  );
}
