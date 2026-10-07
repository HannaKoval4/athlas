import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { useCurrentUser, useLogout } from '../auth/api.ts';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1 hover:bg-stone-200 ${isActive ? 'font-semibold text-amber-900' : ''}`;

/** Centered column for text pages (profile, later notes, search...). */
export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>;
}

/** Shell for logged-in pages: header with navigation and the user menu. */
export function AppLayout() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <div className="flex h-dvh flex-col bg-stone-50 text-stone-900">
      <header className="shrink-0 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-amber-900">
            {t('app.brand')}
          </Link>
          <nav aria-label={t('nav.main')} className="flex gap-1">
            <NavLink to="/" end className={navLinkClass}>
              {t('nav.map')}
            </NavLink>
            <NavLink to="/calendar" className={navLinkClass}>
              {t('nav.calendar')}
            </NavLink>
            <NavLink to="/search" className={navLinkClass}>
              {t('nav.search')}
            </NavLink>
            <NavLink to="/notes" className={navLinkClass}>
              {t('nav.notes')}
            </NavLink>
            <NavLink to="/profile" className={navLinkClass}>
              {t('nav.profile')}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span data-testid="current-user-name">{user?.name}</span>
            <button
              type="button"
              data-testid="logout-button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded border border-stone-300 px-3 py-1 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-amber-700"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>
      {/* Pages decide their own width: the map is full-bleed, text pages use PageContainer. */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
