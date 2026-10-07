import {
  type CardDetails,
  type CardListItem,
  type CardType,
  type CultureDetails,
  type CultureGraph,
  MAX_PAGE_SIZE,
  type Paginated,
} from '@atlas/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

const CARDS_PAGE_SIZE = 20;

/** Culture with card counts per type for the year (all cards when year is null). */
export function useCulture(slug: string, year: number | null) {
  return useQuery({
    queryKey: ['culture', slug, year],
    queryFn: () => {
      const query = year === null ? '' : `?year=${year}`;
      return apiRequest<CultureDetails>(`/cultures/${encodeURIComponent(slug)}${query}`);
    },
    placeholderData: keepPreviousData,
  });
}

export interface CardFilter {
  cultureId: string;
  type: CardType;
  year: number | null;
}

/** Cards of one type of a culture, loaded page by page ("Show more"). */
export function useCardList(filter: CardFilter | null) {
  return useInfiniteQuery({
    queryKey: ['cards', filter],
    enabled: filter !== null,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      // `enabled` guarantees a filter here.
      const { cultureId, type, year } = filter as CardFilter;
      const params = new URLSearchParams({
        cultureId,
        type,
        page: String(pageParam),
        pageSize: String(CARDS_PAGE_SIZE),
      });
      if (year !== null) params.set('year', String(year));
      return apiRequest<Paginated<CardListItem>>(`/cards?${params.toString()}`);
    },
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}

export function useCard(slug: string) {
  return useQuery({
    queryKey: ['card', slug],
    queryFn: () => apiRequest<CardDetails>(`/cards/${encodeURIComponent(slug)}`),
  });
}

/** All visible cards of a culture in one request (gallery); MVP cultures have ~15 cards. */
export function useCultureCards(cultureId: string, year: number | null) {
  return useQuery({
    queryKey: ['culture-cards', cultureId, year],
    queryFn: () => {
      const params = new URLSearchParams({ cultureId, pageSize: String(MAX_PAGE_SIZE) });
      if (year !== null) params.set('year', String(year));
      return apiRequest<Paginated<CardListItem>>(`/cards?${params.toString()}`);
    },
  });
}

export function useCultureGraph(slug: string, year: number | null) {
  return useQuery({
    queryKey: ['culture-graph', slug, year],
    queryFn: () => {
      const query = year === null ? '' : `?year=${year}`;
      return apiRequest<CultureGraph>(`/cultures/${encodeURIComponent(slug)}/graph${query}`);
    },
  });
}
