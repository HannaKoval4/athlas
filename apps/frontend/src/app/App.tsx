import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { onSessionExpired } from '../api/client.ts';
import { clearSession } from '../auth/api.ts';
import { GuestOnly, RequireAuth } from '../auth/route-guards.tsx';
import { AppLayout } from '../components/AppLayout.tsx';
import { LoginPage, RegisterPage } from '../pages/AuthPages.tsx';
import { MapPage } from '../pages/MapPage.tsx';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';
import { ProfilePage } from '../pages/ProfilePage.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
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
              <Route index element={<MapPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
