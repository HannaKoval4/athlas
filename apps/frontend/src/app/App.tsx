import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { isApiError, onSessionExpired } from '../api/client.ts';
import { clearSession } from '../auth/api.ts';
import { GuestOnly, RequireAuth } from '../auth/route-guards.tsx';
import { CultureSheet } from '../atlas/CultureSheet.tsx';
import { AppLayout } from '../components/AppLayout.tsx';
import { LoginPage, RegisterPage } from '../pages/AuthPages.tsx';
import { CalendarPage } from '../pages/CalendarPage.tsx';
import { CardPage } from '../pages/CardPage.tsx';
import { MapPage } from '../pages/MapPage.tsx';
import { NewPage } from '../pages/NewPage.tsx';
import { NotesPage } from '../pages/NotesPage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { ProfilePage } from '../pages/ProfilePage.tsx';
import { SearchPage } from '../pages/SearchPage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // 4xx answers (404, 400, 403) will not change on retry; only network and 5xx errors do.
      retry: (failureCount, error) =>
        !(isApiError(error) && error.status >= 400 && error.status < 500) && failureCount < 3,
    },
  },
});

export function App() {
  useEffect(() => {
    // Refresh token is gone or revoked: forget private data; RequireAuth then redirects to /login.
    onSessionExpired(() => clearSession(queryClient));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              {/* The culture panel is a drawer over the map, so it is a child route of the map. */}
              <Route path="/" element={<MapPage />}>
                <Route path="cultures/:slug" element={<CultureSheet />} />
              </Route>
              <Route path="/cards/:slug" element={<CardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/new" element={<NewPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
