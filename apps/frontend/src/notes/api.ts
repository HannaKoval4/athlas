import type { CreateNoteInput, Note, NoteExportFormat, UpdateNoteInput } from '@atlas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDownload, apiRequest } from '../api/client.ts';

/** What a list of notes is about: one card, one culture (with its cards) or everything. */
export type NotesFilter = { cardId: string } | { cultureId: string } | Record<string, never>;

const notesKey = ['notes'] as const;

export function useNotes(filter: NotesFilter) {
  return useQuery({
    queryKey: [...notesKey, filter],
    queryFn: () => {
      const params = new URLSearchParams(filter);
      const query = params.size > 0 ? `?${params.toString()}` : '';
      return apiRequest<Note[]>(`/notes${query}`);
    },
  });
}

/**
 * Every mutation refetches all note lists: a note appears in up to three of them at once
 * (card, culture, notebook), and the lists are small.
 */
function useInvalidateNotes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: notesKey });
}

export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (input: CreateNoteInput) =>
      apiRequest<Note>('/notes', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateNoteInput & { id: string }) =>
      apiRequest<Note>(`/notes/${id}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/notes/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Downloads the export file and hands it to the browser as a regular download. */
export function useExportNotes() {
  return useMutation({
    mutationFn: async ({ format, lang }: { format: NoteExportFormat; lang: string }) => {
      const file = await apiDownload(
        `/notes/export?format=${format}&lang=${lang}`,
        `atlas-notes.${format}`,
      );
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
      // The click starts the download synchronously; the URL is no longer needed after it.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    },
  });
}
