import type { CalendarDate, Holiday, HolidaysQuery, TodayInHistory } from '@atlas/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client.ts';

/** The user's local date: "today" depends on where the reader is, not on the server. */
export function localToday(now: Date = new Date()): CalendarDate {
  return { month: now.getMonth() + 1, day: now.getDate() };
}

export function useTodayInHistory() {
  const today = localToday();
  return useQuery({
    queryKey: ['calendar', 'today', today],
    queryFn: () =>
      apiRequest<TodayInHistory>(`/calendar/today?month=${today.month}&day=${today.day}`),
    // The entries change only through the admin panel; the key changes with the date.
    staleTime: 60 * 60 * 1000,
  });
}

export function useHolidays(query: HolidaysQuery) {
  return useQuery({
    queryKey: ['holidays', query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query.cultureId) params.set('cultureId', query.cultureId);
      if (query.month !== undefined) params.set('month', String(query.month));
      return apiRequest<Holiday[]>(`/holidays?${params.toString()}`);
    },
  });
}
