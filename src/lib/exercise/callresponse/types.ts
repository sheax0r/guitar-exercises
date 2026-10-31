import type { Note } from '../../music/notes';
import type { Degree } from '../../music/scales';
import type { AttemptRecord } from '../types';
import type { GroupStatBase } from '../chordtones/types';

export const PHRASE_DEGREES: Degree[] = ['1', '2', '3', '4', '5', '6', '7'];
export const PHRASE_BPM = 90;

export interface CallResponseConfig {
  exercise: 'call-response';
  lengths: number[];             // 2..4, drawn per phrase
  degrees: Degree[];             // subset of PHRASE_DEGREES, at least two
  motion: 'stepwise' | 'leaps';
  showStart: boolean;
  rhythm: boolean;               // mixed eighths/quarters, judged on the mic
  keyRoot: Note | 'random';      // 'random' = re-drawn per phrase
  drone: boolean;
  inputMode: 'click' | 'mic';
  micSensitivity: number;
  micDeviceId: string | null;
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
}

export interface PhraseNote { midi: number; note: Note; degree: Degree; sixteenths: number }

export interface CallResponsePrompt {
  keyRoot: Note;
  notes: PhraseNote[];
}

export interface NoteResult {
  noteCorrect: boolean;
  done: boolean;                 // phrase finished (complete or failed)
  correct: boolean;              // whole phrase right (meaningful when done)
  rhythmOff: boolean;            // pitches right but rhythm wrong
  matched: number;               // notes matched so far
}

export interface CallResponseReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perLengthStats: Array<GroupStatBase & { length: number }>;
  perDegreeStats: Array<GroupStatBase & { degree: Degree }>;
  attempts: AttemptRecord[];
}
