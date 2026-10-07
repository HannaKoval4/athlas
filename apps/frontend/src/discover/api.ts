import type { FeedCard, RandomTopic, RecordViewInput, ViewedCard } from '@atlas/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

const historyKey = ['users', 'me', 'history'] as const;

export function useFeed(limit: number) {
  return useQuery({
    queryKey: ['feed', 'new', limit],
    queryFn: () => apiRequest<FeedCard[]>(`/feed/new?limit=${limit}`),
  });
}

/** Every click asks the server again: the answer is random, so nothing is cached. */
export function useRandomTopic() {
  return useMutation({
    mutationFn: () => apiRequest<RandomTopic>('/random-topic'),
  });
}

export function useViewHistory() {
  return useQuery({
    queryKey: historyKey,
    queryFn: () => apiRequest<ViewedCard[]>('/users/me/history'),
  });
}

export function useRecordView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordViewInput) =>
      apiRequest<void>('/users/me/history', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: historyKey }),
  });
}
