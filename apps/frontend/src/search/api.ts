import type { CultureSummary, RegionRef, SearchQuery, SearchResults } from '@atlas/shared';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

/** Search results; null query = nothing to search yet (no words and no filters). */
export function useSearch(query: SearchQuery | null) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: query
      ? () => {
          const params = new URLSearchParams();
          for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== '') params.set(key, String(value));
          }
          return apiRequest<SearchResults>(`/search?${params.toString()}`);
        }
      : skipToken,
    // Typing refines the query: keep showing the previous results instead of a blank page.
    placeholderData: keepPreviousData,
  });
}

// Filter options change only through the admin panel.
export function useCultures() {
  return useQuery({
    queryKey: ['cultures'],
    queryFn: () => apiRequest<CultureSummary[]>('/cultures'),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: () => apiRequest<RegionRef[]>('/regions'),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
