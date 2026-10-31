// Shared shapes for the transcription pipeline (ported from Whistler's core.js).

// A detected note: fractional MIDI pitch, onset and length in seconds.
export interface RawNote {
  midiFloat: number;
  start: number;
  dur: number;
  amp?: number; // Basic Pitch only
}

// A note ready for the tab: whole MIDI pitch, onset and length in seconds.
export interface TabNote {
  midi: number;
  start: number;
  dur: number;
}

export type Engine = 'pitchy' | 'ai';
export type Instrument = 'guitar' | 'whistle' | 'humming' | 'singing';

export interface DetectSettings {
  engine: Engine;
  instrument: Instrument;
  clarity: number; // pitchy: minimum clarity to trust a frame
  minMs: number; // pitchy: drop notes shorter than this
  mergeMs: number; // pitchy: merge same-pitch splits across a gap up to this
}

// The slice of AudioBuffer the pipeline reads, so tests can pass plain arrays.
export interface AudioLike {
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}
