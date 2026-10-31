import type { Note } from '../../music/notes';
import type { ScaleType } from '../../music/modes';
import type { AttemptRecord } from '../types';
import type { Pos } from './shape';
import type { CagedShape } from '../../music/caged';

export type { Pos };

export type ModeExerciseKind = 'play-shape' | 'identify-mode';

export interface PlayShapeConfig {
  exercise: 'play-shape';
  enabledModes: ScaleType[];
  // 'caged': every scale note inside a CAGED position (see CAGED_SCALE_WINDOWS).
  shapeVariant: 'octave' | 'box' | 'caged';
  octaveJudge: 'pitch' | 'fixed'; // used when shapeVariant === 'octave'
  boxSpan: number;                // used when shapeVariant === 'box'
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
  // Sound/ear options (all opt-in; defaults reproduce the original behaviour).
  drone: boolean;                    // sustain the root under each prompt
  highlightCharacteristic: boolean;  // mark the mode's characteristic degree
  fixedRootNote: Note | null;        // null = random root per prompt
  inputMode: 'click' | 'mic';        // 'mic' not valid for octave + fixed judge
  micSensitivity: number;            // 0 (chill) .. 1 (sensitive); mic only
  micDeviceId: string | null;        // chosen audio input; null = default
  displayNotePercentage: number;     // 0..100 of the scale's notes shown on the board
}

export interface PlayShapePrompt {
  root: Pos;
  rootNote: Note;
  mode: ScaleType;
  variant: 'octave' | 'box' | 'caged';
  cagedShape?: CagedShape;  // the position to play, for the 'caged' variant
  // How many positions the player must click to complete this prompt.
  expectedCount: number;
  // A random subset (displayNotePercentage) of the whole-neck scale notes, shown
  // as a study overlay. Empty at 0%; the full scale at 100%.
  visiblePositions: Pos[];
}

export type PlayShapeAnswer = Pos;

export interface IdentifyModeConfig {
  exercise: 'identify-mode';
  enabledModes: ScaleType[];
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
  // Sound/ear options (all opt-in; defaults reproduce the original behaviour).
  drone: boolean;                    // sustain the root under each prompt
  highlightCharacteristic: boolean;  // reveal the characteristic degree after answering
  fixedRootNote: Note | null;        // null = random root per prompt
  promptMode: 'visual' | 'audio';    // 'audio' = hear the scale, name it by ear
  displayNotePercentage: number;     // 0..100 of the scale's notes shown on the board
}

export interface IdentifyModePrompt {
  root: Pos;
  rootNote: Note;
  mode: ScaleType;               // the answer — NOT revealed in the prompt UI
  positions: Pos[];         // all scale-note positions up to maxFret
  rootPositions: Pos[];     // the subset that are root notes (marked distinctly)
  // A random subset (displayNotePercentage) of `positions`, re-rolled per prompt
  // — the notes actually painted in the visual prompt. Full set at 100%.
  visiblePositions: Pos[];
}

export type IdentifyModeAnswer = { mode: ScaleType };

export interface PerModeStat {
  mode: ScaleType;
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
