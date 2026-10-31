import { describe, it, expect, beforeEach } from 'vitest';
import { loadPrefs, savePrefs, type Prefs } from './prefs';

const FULL_PREFS: Prefs = {
  exercise: 'root-notes',
  targetNote: 'A',
  durationSec: 180,
  continuous: false,
  maxFret: 24,
  showAllLabels: false,
  showRootMarkers: false,
  showFretNumbers: true,
  playSound: true,
  algorithm: 'fret-first',
  intervalKind: 'random',
  keyRoot: 'C',
  keyQuality: 'major',
  direction: 'nearest'
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

  it('loads legacy v1 prefs (no modes keys) without throwing', () => {
    localStorage.setItem('guitar-exercises.prefs.v1', JSON.stringify(FULL_PREFS));
    const loaded = loadPrefs();
    expect(loaded.exercise).toBe('root-notes');
    expect(loaded.enabledModes).toBeUndefined();
    expect(loaded.shapeVariant).toBeUndefined();
  });

  it('round-trips modes prefs', () => {
    const p: Prefs = {
      ...FULL_PREFS,
      exercise: 'play-shape',
      enabledModes: ['ionian', 'dorian'],
      shapeVariant: 'box',
      octaveJudge: 'pitch',
      boxSpan: 5
    };
    savePrefs(p);
    expect(loadPrefs()).toEqual(p);
  });

  it('round-trips CAGED prefs', () => {
    const p: Prefs = {
      ...FULL_PREFS,
      exercise: 'caged',
      cagedVariant: 'name-shape',
      enabledShapes: ['C', 'G'],
      chordQualities: ['minor'],
      include7th: true
    };
    savePrefs(p);
    expect(loadPrefs()).toEqual(p);
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
