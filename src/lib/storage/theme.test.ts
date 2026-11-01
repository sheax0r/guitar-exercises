import { describe, it, expect, beforeEach } from 'vitest';
import { currentTheme, setTheme, THEME_KEY } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.colorScheme = '';
  });

  it('remembers and applies the chosen theme', () => {
    setTheme('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(currentTheme()).toBe('dark');
    setTheme('light');
    expect(currentTheme()).toBe('light');
  });
});
