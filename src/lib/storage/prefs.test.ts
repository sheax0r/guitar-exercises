import { describe, it, expect, beforeEach } from 'vitest';
import { loadPrefs, savePrefs, type Prefs } from './prefs';

const FULL_PREFS: Prefs = {
  targetNote: 'A',
  durationSec: 180,
  continuous: false,
  maxFret: 24,
  showAllLabels: false,
  showRootMarkers: false,
  showFretNumbers: true,
  playSound: true,
  algorithm: 'fret-first'
};

describe('prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty object when nothing is stored', () => {
    expect(loadPrefs()).toEqual({});
  });

  it('round-trips a full prefs object', () => {
    savePrefs(FULL_PREFS);
    expect(loadPrefs()).toEqual(FULL_PREFS);
  });

  it('returns empty object on malformed JSON', () => {
    localStorage.setItem('guitar-exercises.prefs.v1', '{not-json');
    expect(loadPrefs()).toEqual({});
  });

  it('does not throw when localStorage is unavailable', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('blocked'); }
    });
    expect(() => savePrefs(FULL_PREFS)).not.toThrow();
    expect(loadPrefs()).toEqual({});
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: original
    });
  });
});
