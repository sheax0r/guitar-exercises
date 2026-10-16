import { CHROMATIC, type Note } from './notes';

export type Mode =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian';

// Semitone offsets from the root for each mode of the major scale.
export const MODE_OFFSETS: Record<Mode, number[]> = {
  ionian:     [0, 2, 4, 5, 7, 9, 11],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian:    [0, 2, 3, 5, 7, 8, 10],
  locrian:    [0, 1, 3, 5, 6, 8, 10]
};

// Display order (modes of the major scale, brightest-ish to darkest by the
// conventional Ionian→Locrian ordering).
export const MODE_ORDER: Mode[] = [
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian'
];

export const MODE_DISPLAY: Record<Mode, string> = {
  ionian: 'Ionian',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  aeolian: 'Aeolian',
  locrian: 'Locrian'
};

// The seven pitch-classes of `mode` rooted at `root`.
export function scaleNotes(root: Note, mode: Mode): Note[] {
  const rootIdx = CHROMATIC.indexOf(root);
  return MODE_OFFSETS[mode].map(o => CHROMATIC[(rootIdx + o) % CHROMATIC.length]);
}

// The characteristic ("colour") note of each mode, as a semitone offset from the
// root. It is the degree that distinguishes the mode from its parallel reference
// scale (major for the bright modes, natural minor for the dark ones). Ionian
// and Aeolian ARE the reference scales, so their entry is a teaching choice:
// Ionian -> maj7 (its brightest identifier vs Mixolydian), Aeolian -> b6 (vs
// Dorian). The other five are unambiguous.
export const MODE_CHARACTERISTIC: Record<Mode, number> = {
  ionian:     11, // maj7
  dorian:      9, // natural 6
  phrygian:    1, // b2
  lydian:      6, // #4
  mixolydian: 10, // b7
  aeolian:     8, // b6
  locrian:     6  // b5
};

// Pitch-class of `mode`'s characteristic degree rooted at `root`.
export function characteristicNote(root: Note, mode: Mode): Note {
  const rootIdx = CHROMATIC.indexOf(root);
  return CHROMATIC[(rootIdx + MODE_CHARACTERISTIC[mode]) % CHROMATIC.length];
}
