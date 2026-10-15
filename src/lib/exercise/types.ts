import type { Note, Fret, ClosestAlgorithm, Direction } from '../music/notes';
import type { Interval, ScaleQuality } from '../music/scales';
import type { StringNum } from '../music/tuning';

export type ExerciseKind = 'root-notes' | 'random-roots' | 'intervals';

export interface ExerciseConfig {
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
  // 'intervals' exercise only. Each musical dimension is either fixed for the
  // whole session or re-drawn per prompt ('random'). Unused by other exercises.
  intervalKind: Interval | 'random';
  keyRoot: Note | 'random';
  keyQuality: ScaleQuality | 'random';
  direction: Direction;
}

export interface ExercisePrompt {
  highlight: { string: StringNum; fret: Fret };
  highlightNote: Note;
  // The note to find for this prompt. For 'root-notes' this is always
  // config.targetNote; for 'random-roots' it is re-randomized per prompt;
  // for 'intervals' it is the diatonic 3rd/5th of highlightNote.
  targetNote: Note;
  // 'intervals' exercise only: the resolved interval and key for this prompt,
  // used to render the header ("Find the 3rd of E — key of C major").
  interval?: Interval;
  keyRoot?: Note;
  keyQuality?: ScaleQuality;
}

export type ExerciseAnswer = { string: StringNum; fret: Fret };

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

export interface ExerciseReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perTargetStats: PerTargetStat[];
  attempts: AttemptRecord[];
}
