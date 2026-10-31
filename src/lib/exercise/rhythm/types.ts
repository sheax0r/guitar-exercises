// Rhythm drill: play on a beat grid against the metronome, scored as onset error in ms.

// Where to play: beat 1 of each bar, every beat, the "and"s (offbeat eighths), or a
// short syncopated pattern drawn per bar.
export type RhythmTarget = 'one' | 'beats' | 'ands' | 'pattern';
export const RHYTHM_TARGETS: RhythmTarget[] = ['one', 'beats', 'ands', 'pattern'];
// What a single grid slot is, for the per-type hit rates.
export type TargetKind = 'one' | 'beat' | 'and';

export const TOLERANCES_MS = [30, 50, 80];
export const BAR_COUNTS = [4, 8, 16];

export interface RhythmConfig {
  exercise: 'rhythm';
  target: RhythmTarget;
  bpm: number;                   // 40..200, quarter notes, 4/4
  bars: number;                  // bars to play after a one-bar count-in
  toleranceMs: number;           // |error| within this counts as a hit
  inputMode: 'click' | 'mic';    // 'click' = tap a key or the pad (no mic)
  micSensitivity: number;
  micDeviceId: string | null;
}

// A beat-grid slot to hit, in AudioContext seconds.
export interface GridTarget { t: number; kind: TargetKind; bar: number }

export interface TargetResult { kind: TargetKind; bar: number; errorMs: number | null } // null = missed

export interface KindStat { kind: TargetKind; targets: number; hits: number; meanAbsMs: number | null }

export interface RhythmReport {
  totalPrompts: number;          // grid targets
  correctCount: number;          // hits
  incorrectCount: number;        // misses + extra hits
  accuracy: number;              // hits / (targets + extras)
  extras: number;                // onsets that matched no target
  meanAbsMs: number | null;      // over hits
  biasMs: number | null;         // mean signed error over hits; > 0 = late
  perKind: KindStat[];
  results: TargetResult[];       // in time order
  toleranceMs: number;
  calibMs: number;               // latency offset applied (mic only)
}
