import type { Note } from '../../music/notes';
import type { CagedShape, ChordQuality, ChordType, Pos } from '../../music/caged';
import type { AttemptRecord } from '../types';

export type CagedVariant = 'find-tones' | 'name-shape' | 'next-shape';

export interface CagedConfig {
  exercise: 'caged';
  cagedVariant: CagedVariant;
  enabledShapes: CagedShape[];
  qualities: ChordQuality[];
  include7th: boolean;
  fixedRootNote: Note | null;     // null = random chord root per prompt
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
  inputMode: 'click' | 'mic';     // 'mic' valid only for find-tones
  micSensitivity: number;
  micDeviceId: string | null;
}

export interface CagedPrompt {
  variant: CagedVariant;
  shape: CagedShape;              // the shape asked about (next-shape: the target)
  fromShape: CagedShape | null;   // next-shape only: the shape you're "in"
  rootNote: Note;
  chord: ChordType;
  anchor: Pos;                    // root of the shape on screen (next-shape: where you are)
  window: [number, number];       // that shape's fret window
  shownPositions: Pos[];          // chord tones painted on the board (empty for find-tones)
  expectedCount: number;          // positions to click (name-shape: 1 answer)
}

export interface CagedNameAnswer { shape: CagedShape; root: Note }
export type CagedAnswer = Pos | CagedNameAnswer;

export interface PerShapeStat {
  shape: CagedShape;
  timesAsked: number;
  correctCount: number;
  avgTimeMs: number;
}

export interface CagedReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perShapeStats: PerShapeStat[];
  attempts: AttemptRecord[];
}
