import type { Note } from '../../music/notes';
import type { StringNum } from '../../music/tuning';
import type { Pos } from '../../music/caged';
import type { AttemptRecord } from '../types';
import type { GroupStatBase } from '../chordtones/types';

export interface LickDrillConfig {
  exercise: 'lick-drill';
  lick: number[];                        // MIDI pitches in order (1..MAX_LICK_NOTES)
  lickName: string;
  target: Note | 'random' | 'same';      // the answer's first note; 'random' = another key per prompt
  startString: StringNum | 'random' | 'any';
  inputMode: 'click' | 'mic';
  micSensitivity: number;
  micDeviceId: string | null;
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
}

export interface LickPrompt {
  keyRoot: Note;                         // the answer's first note
  shift: number;                         // semitones from the original key, -6..5
  startString: StringNum | null;         // null = any string
  call: Pos[];                           // the original lick, fretted (shown and played)
  answer: Pos[];                         // the transposed lick, fretted from the start string
  notes: Array<{ midi: number; note: Note; sixteenths: number }>;
}

export interface LickDrillReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perShiftStats: Array<GroupStatBase & { shift: number; keyRoot: Note }>;
  perIndexStats: Array<GroupStatBase & { index: number }>;   // 1-based note index
  attempts: AttemptRecord[];
}
