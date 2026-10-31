import type { Note, ClosestAlgorithm } from '../../music/notes';
import type { Degree } from '../../music/scales';
import type { Pos } from '../../music/caged';
import type { AttemptRecord } from '../types';

// 'name': a note is highlighted, name its degree in the key.
// 'find': "find the b7 of D", nearest to a highlighted start position.
export type DegreeVariant = 'name' | 'find';

export interface DegreesConfig {
  exercise: 'degrees';
  degreeVariant: DegreeVariant;
  keyRoot: Note | 'random';       // 'random' = re-drawn per prompt
  algorithm: ClosestAlgorithm;    // 'find': which occurrence counts as nearest
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
}

export interface DegreesPrompt {
  variant: DegreeVariant;
  keyRoot: Note;
  degree: Degree;                 // the answer for 'name', the ask for 'find'
  highlight: Pos;                 // the shown note ('name') or start ('find')
  targetNote: Note;               // keyRoot + degree
}

export type DegreesAnswer = Pos | { degree: Degree };

export interface PerDegreeStat {
  degree: Degree;
  timesAsked: number;
  correctCount: number;
  avgTimeMs: number;
}

export interface DegreesReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perDegreeStats: PerDegreeStat[];
  attempts: AttemptRecord[];
}
