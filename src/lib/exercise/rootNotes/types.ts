import type { Note, Fret, ClosestAlgorithm } from '../../music/notes';
import type { StringNum } from '../../music/tuning';

export type ExerciseKind = 'root-notes' | 'random-roots';

export interface RootNotesConfig {
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
}

export interface RootNotesPrompt {
  highlight: { string: StringNum; fret: Fret };
  highlightNote: Note;
  // The note to find for this prompt. For 'root-notes' this is always
  // config.targetNote; for 'random-roots' it is re-randomized per prompt.
  targetNote: Note;
}

export type RootNotesAnswer = { string: StringNum; fret: Fret };

export interface PerTargetStat {
  position: { string: StringNum; fret: Fret };
  timesAsked: number;
  correctCount: number;
  avgTimeMs: number;
}

export interface AttemptRecord {
  elapsedMs: number;
  correct: boolean;
  // The note the player was asked to find on this attempt. Constant across a
  // 'root-notes' session; varies per attempt for 'random-roots'.
  targetNote: Note;
}

export interface RootNotesReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perTargetStats: PerTargetStat[];
  attempts: AttemptRecord[];
}
