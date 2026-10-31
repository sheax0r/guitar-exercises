import { CHROMATIC, type Note } from './notes';

export type Mode =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian';

// Every scale the modes exercises can drill: the seven modes of the major scale
// plus pentatonics, blues and the two other minors. The exercises only ever use
// a scale's pitch-class set, so a new scale is just a new offsets entry.
export type ScaleType =
  | Mode
  | 'major-pentatonic'
  | 'minor-pentatonic'
  | 'blues'
  | 'harmonic-minor'
  | 'melodic-minor';

// Semitone offsets from the root for each scale.
export const MODE_OFFSETS: Record<ScaleType, number[]> = {
  ionian:     [0, 2, 4, 5, 7, 9, 11],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  phrygian:   [0, 1, 3, 5, 7, 8, 10],
  lydian:     [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian:    [0, 2, 3, 5, 7, 8, 10],
  locrian:    [0, 1, 3, 5, 6, 8, 10],
  'major-pentatonic': [0, 2, 4, 7, 9],
  'minor-pentatonic': [0, 3, 5, 7, 10],
  blues:              [0, 3, 5, 6, 7, 10],
  'harmonic-minor':   [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor':    [0, 2, 3, 5, 7, 9, 11]
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

// The modes, then the other scales.
export const SCALE_ORDER: ScaleType[] = [
  ...MODE_ORDER,
  'major-pentatonic',
  'minor-pentatonic',
  'blues',
  'harmonic-minor',
  'melodic-minor'
];

export const MODE_DISPLAY: Record<ScaleType, string> = {
  ionian: 'Ionian',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  aeolian: 'Aeolian',
  locrian: 'Locrian',
  'major-pentatonic': 'Major pentatonic',
  'minor-pentatonic': 'Minor pentatonic',
  blues: 'Blues',
  'harmonic-minor': 'Harmonic minor',
  'melodic-minor': 'Melodic minor'
};

// The pitch-classes of `scale` rooted at `root`.
export function scaleNotes(root: Note, scale: ScaleType): Note[] {
  const rootIdx = CHROMATIC.indexOf(root);
  return MODE_OFFSETS[scale].map(o => CHROMATIC[(rootIdx + o) % CHROMATIC.length]);
}

// 'major' when the scale has a major 3rd, else 'minor'. Picks which CAGED chord
// shapes (major or minor) a scale's positions hang off.
export function scaleFamily(scale: ScaleType): 'major' | 'minor' {
  return MODE_OFFSETS[scale].includes(4) ? 'major' : 'minor';
}

// The characteristic ("colour") note of each mode, as a semitone offset from the
// root. It is the degree that distinguishes the mode from its parallel reference
// scale (major for the bright modes, natural minor for the dark ones). Ionian
// and Aeolian ARE the reference scales, so their entry is a teaching choice:
// Ionian -> maj7 (its brightest identifier vs Mixolydian), Aeolian -> b6 (vs
// Dorian). The other five are unambiguous. The non-modal scales are teaching
// choices too: each one's tell against its nearest sibling here.
export const MODE_CHARACTERISTIC: Record<ScaleType, number> = {
  ionian:     11, // maj7
  dorian:      9, // natural 6
  phrygian:    1, // b2
  lydian:      6, // #4
  mixolydian: 10, // b7
  aeolian:     8, // b6
  locrian:     6, // b5
  'major-pentatonic': 4, // major 3rd (vs minor pentatonic)
  'minor-pentatonic': 3, // b3 (vs major pentatonic)
  blues:              6, // b5, the blue note
  'harmonic-minor':  11, // maj7 (vs natural minor)
  'melodic-minor':    9  // natural 6 (vs harmonic minor)
};

// Pitch-class of `scale`'s characteristic degree rooted at `root`.
export function characteristicNote(root: Note, scale: ScaleType): Note {
  const rootIdx = CHROMATIC.indexOf(root);
  return CHROMATIC[(rootIdx + MODE_CHARACTERISTIC[scale]) % CHROMATIC.length];
}
