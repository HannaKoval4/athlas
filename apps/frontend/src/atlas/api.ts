import type { EraSummary, MapSlice } from '@atlas/shared';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

export function useEras() {
  return useQuery({
    queryKey: ['eras'],
    queryFn: () => apiRequest<EraSummary[]>('/eras'),
    // Eras change only through the admin panel; one fetch per session is enough.
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Map time slice; the previous year stays on screen while the next one loads. */
export function useMapSlice(selection: { era: string; year: number } | null) {
  return useQuery({
    queryKey: ['map', selection?.era, selection?.year],
    queryFn: selection
      ? () => {
          const params = new URLSearchParams({ year: String(selection.year), era: selection.era });
          return apiRequest<MapSlice>(`/map?${params.toString()}`);
        }
      : skipToken,
    placeholderData: keepPreviousData,
  });
}
