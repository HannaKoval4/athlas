import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingScreen } from '../components/LoadingScreen.tsx';
import { useCurrentUser } from './api.ts';

export interface RedirectState {
  from?: string;
}

/** Pages for logged-in users; guests are sent to /login and come back after logging in. */
export function RequireAuth() {
  const { data: user, isPending } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <LoadingScreen />;
  if (!user) {
    const state: RedirectState = { from: location.pathname + location.search };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}

/**
 * /login and /register: a logged-in user has nothing to do there. This is also the only place
 * that redirects after a successful login: the page just updates the cached user.
 */
export function GuestOnly() {
  const { data: user, isPending } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <LoadingScreen />;
  if (user) {
    const { from } = (location.state ?? {}) as RedirectState;
    return <Navigate to={from ?? '/'} replace />;
  }
  return <Outlet />;
}
