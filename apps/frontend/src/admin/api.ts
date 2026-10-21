import type {
  AdminCard,
  AdminCardLink,
  AdminCardListItem,
  AdminCardSource,
  AdminCardsQuery,
  CardInput,
  CardLinkInput,
  CardSourceInput,
  Paginated,
} from '@atlas/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

/** Resources with plain list / create / replace / delete endpoints under /api/admin. */
export type AdminResource =
  | 'eras'
  | 'cultures'
  | 'regions'
  | 'culture-regions'
  | 'sources'
  | 'holidays'
  | 'quizzes'
  | 'questions';

const adminKey = ['admin'] as const;

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.size > 0 ? `?${search.toString()}` : '';
}

export function useAdminList<T>(
  resource: AdminResource,
  params: Record<string, string | undefined> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: [...adminKey, resource, params],
    queryFn: () => apiRequest<T[]>(`/admin/${resource}${queryString(params)}`),
    enabled,
  });
}

/**
 * After any admin change every cached query is refetched, not only the admin lists: the map,
 * search, calendar and card pages read the same tables, and the change must show up there
 * at once (F-18). Admin changes are rare, so the extra requests cost nothing noticeable.
 */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

/** Creates (no id) or replaces (PUT, with id) a record. */
export function useAdminSave<TInput, TResult>(resource: AdminResource) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TInput }) =>
      apiRequest<TResult>(id ? `/admin/${resource}/${id}` : `/admin/${resource}`, {
        method: id ? 'PUT' : 'POST',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useAdminDelete(resource: AdminResource | 'cards') {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/admin/${resource}/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

// ---- Cards -------------------------------------------------------------------------------------

export function useAdminCards(query: AdminCardsQuery, enabled = true) {
  return useQuery({
    queryKey: [...adminKey, 'cards', query],
    queryFn: () =>
      apiRequest<Paginated<AdminCardListItem>>(`/admin/cards${queryString({ ...query })}`),
    // Paging and filtering keep the old rows on screen until the new page arrives.
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminCard(id: string | undefined) {
  return useQuery({
    queryKey: [...adminKey, 'card', id],
    queryFn: () => apiRequest<AdminCard>(`/admin/cards/${id ?? ''}`),
    enabled: Boolean(id),
  });
}

export function useSaveCard() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CardInput }) =>
      apiRequest<AdminCard>(id ? `/admin/cards/${id}` : '/admin/cards', {
        method: id ? 'PUT' : 'POST',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useSetPublished() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      apiRequest<AdminCard>(`/admin/cards/${id}/${published ? 'publish' : 'unpublish'}`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}

export function useCreateLink() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CardLinkInput) =>
      apiRequest<AdminCardLink>('/admin/card-links', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteLink() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ fromCardId, toCardId, relationType }: CardLinkInput) =>
      apiRequest<void>(`/admin/card-links/${fromCardId}/${toCardId}/${relationType}`, {
        method: 'DELETE',
      }),
    onSuccess: invalidate,
  });
}

export function useAttachSource() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: CardSourceInput) =>
      apiRequest<AdminCardSource>('/admin/card-sources', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useDetachSource() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ cardId, sourceId }: { cardId: string; sourceId: string }) =>
      apiRequest<void>(`/admin/card-sources/${cardId}/${sourceId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
