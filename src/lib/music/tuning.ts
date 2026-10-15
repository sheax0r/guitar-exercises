import type { Note } from './notes';

export type StringNum = 1 | 2 | 3 | 4 | 5 | 6;

// String 1 = high E (highest pitch), string 6 = low E.
export const STANDARD_TUNING: Record<StringNum, Note> = {
  1: 'E',
  2: 'B',
  3: 'G',
  4: 'D',
  5: 'A',
  6: 'E'
};

// MIDI note numbers for each open string (string 1 = high E = E4 = 64).
// Used to compare pitch height across strings/frets.
export const STANDARD_TUNING_MIDI: Record<StringNum, number> = {
  1: 64,
  2: 59,
  3: 55,
  4: 50,
  5: 45,
  6: 40
};
