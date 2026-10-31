import type { Note, ClosestAlgorithm, Direction } from '../music/notes';
import type { Mode } from '../music/modes';
import type { Interval, ScaleQuality } from '../music/scales';
import type { ExerciseKind } from '../exercise/types';
import type { ModeExerciseKind } from '../exercise/modes/types';
import type { CagedVariant } from '../exercise/caged/types';
import type { CagedShape, ChordQuality } from '../music/caged';

const KEY = 'guitar-exercises.prefs.v1';

export interface Prefs {
  exercise: ExerciseKind | ModeExerciseKind | 'caged';
  targetNote: Note;
  durationSec: number;
  continuous: boolean;
  maxFret: number;
  showAllLabels: boolean;
  showRootMarkers: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
  algorithm: ClosestAlgorithm;
  // 'intervals' exercise settings.
  intervalKind: Interval | 'random';
  keyRoot: Note | 'random';
  keyQuality: ScaleQuality | 'random';
  direction: Direction;
  // Modes-exercise settings (optional; absent in legacy v1 prefs).
  enabledModes?: Mode[];
  shapeVariant?: 'octave' | 'box';
  octaveJudge?: 'pitch' | 'fixed';
  boxSpan?: number;
  // Modes sound/ear settings (optional; absent in legacy prefs).
  drone?: boolean;
  highlightCharacteristic?: boolean;
  fixedRootNote?: Note | 'random'; // 'random' sentinel ↔ config null
  inputMode?: 'click' | 'mic';
  identifyPromptMode?: 'visual' | 'audio';
  micSensitivity?: number;          // 0..1
  micDeviceId?: string | null;      // chosen audio input (device-specific)
  displayNotePercentage?: number;   // 0..100 of scale notes shown (modes exercises)
  // CAGED settings (optional; root and mic settings are shared with modes).
  cagedVariant?: CagedVariant;
  enabledShapes?: CagedShape[];
  chordQualities?: ChordQuality[];
  include7th?: boolean;
  recentSessions?: string[];        // session hashes, newest first
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
