import type { Note, ClosestAlgorithm, Direction } from '../music/notes';
import type { ExerciseKind } from '../exercise/types';
import type { Interval, ScaleQuality } from '../music/scales';

const KEY = 'guitar-exercises.prefs.v1';

export interface Prefs {
  exercise: ExerciseKind;
  targetNote: Note;
  durationSec: number;
  continuous: boolean;
  maxFret: number;
  showAllLabels: boolean;
  showRootMarkers: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
  algorithm: ClosestAlgorithm;
  intervalKind: Interval | 'random';
  keyRoot: Note | 'random';
  keyQuality: ScaleQuality | 'random';
  direction: Direction;
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
