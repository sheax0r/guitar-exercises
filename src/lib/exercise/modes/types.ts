import type { Note } from '../../music/notes';
import type { Mode } from '../../music/modes';
import type { AttemptRecord } from '../types';
import type { Pos } from './shape';

export type { Pos };

export type ModeExerciseKind = 'play-shape' | 'identify-mode';

export interface PlayShapeConfig {
  exercise: 'play-shape';
  enabledModes: Mode[];
  shapeVariant: 'octave' | 'box';
  octaveJudge: 'pitch' | 'fixed'; // used when shapeVariant === 'octave'
  boxSpan: number;                // used when shapeVariant === 'box'
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
}

export interface PlayShapePrompt {
  root: Pos;
  rootNote: Note;
  mode: Mode;
  variant: 'octave' | 'box';
  // How many positions the player must click to complete this prompt.
  expectedCount: number;
}

export type PlayShapeAnswer = Pos;

export interface IdentifyModeConfig {
  exercise: 'identify-mode';
  enabledModes: Mode[];
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
}

export interface IdentifyModePrompt {
  root: Pos;
  rootNote: Note;
  mode: Mode;               // the answer — NOT revealed in the prompt UI
  positions: Pos[];         // all scale-note positions up to maxFret
  rootPositions: Pos[];     // the subset that are root notes (marked distinctly)
}

export type IdentifyModeAnswer = { mode: Mode };

export interface PerModeStat {
  mode: Mode;
  timesAsked: number;
  correctCount: number;
  avgTimeMs: number;
}

export interface ModesReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perModeStats: PerModeStat[];
  attempts: AttemptRecord[];
}
