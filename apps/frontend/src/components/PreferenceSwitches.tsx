import { Locale, ThemePreference } from '@atlas/shared';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../app/preferences-context.ts';

const THEME_ORDER: readonly ThemePreference[] = [
  ThemePreference.LIGHT,
  ThemePreference.DARK,
  ThemePreference.SYSTEM,
];
const THEME_ICON = { LIGHT: Sun, DARK: Moon, SYSTEM: Monitor } as const;

const switchClass =
  'inline-flex h-8 min-w-8 items-center justify-center rounded border border-input px-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-amber-700 dark:focus-visible:outline-amber-400';

/**
 * Quick theme and language switches for the header and the login page. The theme button cycles
 * light -> dark -> as in the system; the language button switches to the other language.
 */
export function PreferenceSwitches() {
  const { t } = useTranslation();
  const { theme, locale, setTheme, setLocale } = usePreferences();
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  const nextLocale = locale === Locale.RU ? Locale.EN : Locale.RU;
  const Icon = THEME_ICON[theme];

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="theme-switch"
        data-theme={theme}
        className={switchClass}
        title={t('preferences.themeNow', { theme: t(`profile.themes.${theme}`) })}
        aria-label={t('preferences.switchTheme', {
          theme: t(`profile.themes.${theme}`),
          next: t(`profile.themes.${nextTheme ?? ThemePreference.SYSTEM}`),
        })}
        onClick={() => nextTheme && setTheme(nextTheme)}
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        data-testid="locale-switch"
        className={switchClass}
        // The name of the other language in that language: "English" / "Русский".
        aria-label={t(`preferences.switchTo.${nextLocale}`)}
        lang={nextLocale === Locale.EN ? 'en' : 'ru'}
        onClick={() => setLocale(nextLocale)}
      >
        {nextLocale}
      </button>
    </div>
  );
}
