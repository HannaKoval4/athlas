import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="grid min-h-screen place-items-center bg-stone-50 text-stone-900">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">{t('notFound.title')}</h1>
        <Link to="/" className="text-amber-800 underline">
          {t('notFound.toHome')}
        </Link>
      </div>
    </main>
  );
}
