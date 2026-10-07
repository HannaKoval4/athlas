import type { Locale, ThemePreference, UserProfile } from '@atlas/shared';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, isApiError } from '../api/client.ts';

export const currentUserKey = ['auth', 'me'] as const;

/**
 * Forgets the session: drops every cached private query but keeps the current-user query
 * itself (it may be mid-flight; removing it would leave its observers pending forever).
 */
export function clearSession(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== currentUserKey[0] });
  queryClient.setQueryData(currentUserKey, null);
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export interface ProfileInput {
  name?: string;
  email?: string;
  theme?: ThemePreference;
  locale?: Locale;
}

export interface PasswordInput {
  currentPassword: string;
  newPassword: string;
}

/** The logged-in user, or null for a guest. The single source of truth for "am I logged in". */
export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserKey,
    queryFn: async (): Promise<UserProfile | null> => {
      try {
        return await apiRequest<UserProfile>('/auth/me');
      } catch (error) {
        if (isApiError(error, 401)) return null;
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Login and registration both answer with the profile: put it into the cache, no extra request. */
function useSessionMutation<TInput>(path: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => apiRequest<UserProfile>(path, { method: 'POST', body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserKey, user);
    },
  });
}

export const useLogin = () => useSessionMutation<LoginInput>('/auth/login');
export const useRegister = () => useSessionMutation<RegisterInput>('/auth/register');

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
    // Even if the request fails the local session must end: drop every cached private query.
    onSettled: () => clearSession(queryClient),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      apiRequest<UserProfile>('/users/me', { method: 'PATCH', body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserKey, user);
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: PasswordInput) =>
      apiRequest<void>('/users/me/password', { method: 'PATCH', body: input }),
  });
}
