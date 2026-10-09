import { Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAchievements } from './api.ts';

/** Profile section: earned "Эпоха изучена" achievements (F-16). */
export function Achievements() {
  const { t, i18n } = useTranslation();
  const achievements = useAchievements();

  return (
    <section aria-labelledby="achievements" className="flex flex-col gap-2">
      <h2 id="achievements" className="text-xl font-semibold">
        {t('achievements.title')}
      </h2>
      {achievements.isError ? (
        <p role="alert">{t('achievements.loadError')}</p>
      ) : !achievements.data ? (
        <p role="status">{t('app.loading')}</p>
      ) : achievements.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('achievements.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="achievements">
          {achievements.data.map((achievement) => (
            <li key={achievement.code} className="flex items-start gap-2 text-sm">
              <Award className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
              <span>
                <span className="font-medium">{t('achievements.eraStudied')}</span>
                {achievement.quiz && (
                  <>
                    {': '}
                    <Link
                      to={`/quizzes/${achievement.quiz.id}`}
                      className="underline underline-offset-2"
                    >
                      {achievement.quiz.era.name} · {achievement.quiz.culture.name}
                    </Link>
                  </>
                )}
                <span className="text-muted-foreground">
                  {' · '}
                  {new Date(achievement.earnedAt).toLocaleDateString(i18n.language, {
                    dateStyle: 'medium',
                  })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
