import type {
  Achievement,
  AttemptResult,
  QuizSummary,
  QuizzesQuery,
  StartedAttempt,
  SubmitAttemptInput,
} from '@atlas/shared';
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

const quizzesKey = ['quizzes'] as const;
const achievementsKey = ['users', 'me', 'achievements'] as const;
const attemptKey = (id: string) => ['quiz-attempts', id] as const;

export function useQuizzes(query: QuizzesQuery | null) {
  return useQuery({
    queryKey: [...quizzesKey, 'list', query],
    queryFn: query
      ? () => {
          const params = new URLSearchParams();
          if (query.cultureId) params.set('cultureId', query.cultureId);
          if (query.eraId) params.set('eraId', query.eraId);
          return apiRequest<QuizSummary[]>(`/quizzes?${params.toString()}`);
        }
      : skipToken,
  });
}

export function useQuiz(id: string) {
  return useQuery({
    queryKey: [...quizzesKey, 'one', id],
    queryFn: () => apiRequest<QuizSummary>(`/quizzes/${id}`),
  });
}

/** Every start draws new questions, so it is a mutation, not a cached query. */
export function useStartAttempt() {
  return useMutation({
    mutationFn: (quizId: string) =>
      apiRequest<StartedAttempt>(`/quizzes/${quizId}/attempts`, { method: 'POST' }),
  });
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, ...input }: SubmitAttemptInput & { attemptId: string }) =>
      apiRequest<AttemptResult>(`/quizzes/attempts/${attemptId}/submit`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: async (result) => {
      // The result page shows this answer, including the achievement it has just earned.
      queryClient.setQueryData(attemptKey(result.id), result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: quizzesKey }),
        queryClient.invalidateQueries({ queryKey: achievementsKey }),
      ]);
    },
  });
}

export function useAttemptResult(id: string) {
  return useQuery({
    queryKey: attemptKey(id),
    queryFn: () => apiRequest<AttemptResult>(`/quizzes/attempts/${id}`),
    // A finished attempt never changes.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: achievementsKey,
    queryFn: () => apiRequest<Achievement[]>('/users/me/achievements'),
  });
}
