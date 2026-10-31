import type { Note, ClosestAlgorithm } from '../../music/notes';
import type { ChordType, Pos } from '../../music/caged';
import type { ProgressionId } from '../../music/progressions';
import type { AttemptRecord } from '../types';

// 'guide' alternates 3rd and 7th; 'any' is any chord tone but the last note.
export type ToneTarget = 'any' | '3rd' | '7th' | 'guide';
export type ToneKind = 'any' | '3rd' | '7th';

export interface ChordTonesConfig {
  exercise: 'chord-tones';
  progression: ProgressionId;
  keyRoot: Note | 'random';      // 'random' = re-drawn each loop
  target: ToneTarget;
  backing: 'chord' | 'drone' | 'off';
  tempo: 'untimed' | 'timed';
  bpm: number;                   // timed only
  barsPerChord: number;          // timed only: bars per progression bar
  algorithm: ClosestAlgorithm;
  inputMode: 'click' | 'mic';
  micSensitivity: number;
  micDeviceId: string | null;
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
}

export interface ChordTonesPrompt {
  keyRoot: Note;
  index: number;                 // chord index within the progression
  numeral: string;
  chordRoot: Note;
  chordType: ChordType;
  bars: number;                  // merged length of this chord, in progression bars
  tone: ToneKind;                // resolved ('guide' becomes 3rd or 7th)
  targetNotes: Note[];
  from: Pos;                     // previous answer, or the random start
}

export interface GroupStatBase { timesAsked: number; correctCount: number; avgTimeMs: number }

export interface ChordTonesReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perChordStats: Array<GroupStatBase & { numeral: string }>;
  perToneStats: Array<GroupStatBase & { tone: ToneKind }>;
  attempts: AttemptRecord[];
}
