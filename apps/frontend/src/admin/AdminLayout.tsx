import { Role } from '@atlas/shared';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { useCurrentUser } from '../auth/api.ts';
import { NotFoundPage } from '../pages/NotFoundPage.tsx';

/** Admin pages; for other roles they do not exist (404, like a hidden draft). */
export function RequireAdmin() {
  const { data: user } = useCurrentUser();
  // RequireAuth above has already waited for the user.
  if (user?.role !== Role.ADMIN) return <NotFoundPage />;
  return <Outlet />;
}

const SECTIONS = [
  'cards',
  'cultures',
  'regions',
  'culture-regions',
  'eras',
  'sources',
  'holidays',
  'quizzes',
] as const;

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-1.5 hover:bg-muted ${
    isActive ? 'bg-muted font-semibold text-amber-900 dark:text-amber-200' : ''
  }`;

/** F-18: section menu on the left, the section's table on the right. */
export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
      <nav aria-label={t('admin.nav')} className="shrink-0 md:w-52">
        <h1 className="mb-3 text-lg font-bold">{t('admin.title')}</h1>
        <ul className="flex flex-wrap gap-1 md:flex-col">
          {SECTIONS.map((section) => (
            <li key={section}>
              <NavLink
                to={`/admin/${section}`}
                className={linkClass}
                data-testid={`admin-nav-${section}`}
              >
                {t(`admin.sections.${section}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <section className="min-w-0 flex-1">
        <Outlet />
      </section>
    </div>
  );
}
