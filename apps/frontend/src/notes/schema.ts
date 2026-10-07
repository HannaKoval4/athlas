import { NOTE_CONTENT_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '@atlas/shared';
import { z } from 'zod';
import type { ValidationKey } from '../i18n/index.ts';

const msg = (key: ValidationKey) => key;

// Same limits as the server (CreateNoteDto); a blank title is sent as "no title".
export const noteSchema = z.object({
  title: z.string().trim().max(NOTE_TITLE_MAX_LENGTH, msg('noteTitleTooLong')),
  content: z
    .string()
    .trim()
    .min(1, msg('required'))
    .max(NOTE_CONTENT_MAX_LENGTH, msg('noteContentTooLong')),
});

export type NoteForm = z.infer<typeof noteSchema>;
