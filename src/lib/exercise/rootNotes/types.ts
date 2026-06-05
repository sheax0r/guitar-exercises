import type { Note, Fret, ClosestAlgorithm } from '../../music/notes';
import type { StringNum } from '../../music/tuning';

export interface RootNotesConfig {
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
