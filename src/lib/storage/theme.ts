// Light/dark choice, remembered in localStorage. With nothing stored the page
// follows the OS (app.css sets color-scheme: light dark). index.html applies the
// stored choice before first paint so there is no flash.
export type Theme = 'light' | 'dark';
export const THEME_KEY = 'guitar-exercises.theme';

export function currentTheme(): Theme {
  const set = document.documentElement.style.colorScheme;
  if (set === 'light' || set === 'dark') return set;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.style.colorScheme = theme;
  try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* unavailable */ }
}
