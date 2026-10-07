import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, FormError, TextArea, TextInput } from '../components/form.tsx';
import { Button } from '../components/ui/button.tsx';
import { type NoteForm, noteSchema } from './schema.ts';

interface NoteEditorProps {
  defaultValues?: NoteForm;
  pending: boolean;
  /** Translated server error, shown above the buttons. */
  error?: string;
  onSubmit: (values: NoteForm) => void;
  onCancel: () => void;
}

/** Title + Markdown text form, used both to add and to edit a note. */
export function NoteEditor({ defaultValues, pending, error, onSubmit, onCancel }: NoteEditorProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
    defaultValues: defaultValues ?? { title: '', content: '' },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      data-testid="note-editor"
      onSubmit={handleSubmit(onSubmit)}
    >
      <Field label={t('notes.titleLabel')} error={errors.title?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            data-testid="note-title"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...register('title')}
          />
        )}
      </Field>
      <Field
        label={t('notes.contentLabel')}
        hint={t('notes.contentHint')}
        error={errors.content?.message}
      >
        {({ id, describedBy, invalid }) => (
          <TextArea
            id={id}
            rows={4}
            // The editor opens on a user action ("Add a note" / "Edit"), so focus follows it.
            autoFocus
            data-testid="note-content"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            {...register('content')}
          />
        )}
      </Field>
      <FormError>{error}</FormError>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} data-testid="note-save">
          {t('notes.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('notes.cancel')}
        </Button>
      </div>
    </form>
  );
}
