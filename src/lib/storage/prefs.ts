import type { Note, ClosestAlgorithm } from '../music/notes';
import type { Mode } from '../music/modes';
import type { ExerciseKind } from '../exercise/rootNotes/types';
import type { ModeExerciseKind } from '../exercise/modes/types';

const KEY = 'guitar-exercises.prefs.v1';

export interface Prefs {
  exercise: ExerciseKind | ModeExerciseKind;
  targetNote: Note;
  durationSec: number;
  continuous: boolean;
  maxFret: number;
  showAllLabels: boolean;
  showRootMarkers: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
  algorithm: ClosestAlgorithm;
  // Modes-exercise settings (optional; absent in legacy v1 prefs).
  enabledModes?: Mode[];
  shapeVariant?: 'octave' | 'box';
  octaveJudge?: 'pitch' | 'fixed';
  boxSpan?: number;
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
