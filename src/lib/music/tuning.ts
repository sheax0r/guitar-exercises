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
