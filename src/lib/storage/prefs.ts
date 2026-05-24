import type { Note, ClosestAlgorithm } from '../music/notes';

const KEY = 'guitar-exercises.prefs.v1';

export interface Prefs {
  targetNote: Note;
  durationSec: number;
  continuous: boolean;
  maxFret: number;
  showAllLabels: boolean;
  showRootMarkers: boolean;
  playSound: boolean;
  algorithm: ClosestAlgorithm;
}

export function loadPrefs(): Partial<Prefs> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Partial<Prefs>;
  } catch {
    return {};
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable or quota exceeded. Silently no-op.
  }
}
