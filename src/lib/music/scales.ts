import { CHROMATIC, type Note } from './notes';

export type ScaleQuality = 'major' | 'minor';
export type Interval = '2nd' | '3rd' | '4th' | '5th' | '6th' | '7th';
export const INTERVAL_ORDER: Interval[] = ['2nd', '3rd', '4th', '5th', '6th', '7th'];

// Semitone offsets from the tonic. 'minor' is the natural minor (Aeolian).
const STEPS: Record<ScaleQuality, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10]
};

// Scale degrees to add for each interval (0-indexed: a "3rd" is two degrees up).
const DEGREE_OFFSET: Record<Interval, number> = {
  '2nd': 1,
  '3rd': 2,
  '4th': 3,
  '5th': 4,
  '6th': 5,
  '7th': 6
};

export function scaleNotes(root: Note, quality: ScaleQuality): Note[] {
  const rootIdx = CHROMATIC.indexOf(root);
  return STEPS[quality].map(step => CHROMATIC[(rootIdx + step) % CHROMATIC.length]);
}

// The diatonic interval (2nd…7th) above `note` within the given key, or null if `note`
// is not in that key's scale.
export function diatonicInterval(
  root: Note,
  quality: ScaleQuality,
  note: Note,
  interval: Interval
): Note | null {
  const scale = scaleNotes(root, quality);
  const degree = scale.indexOf(note);
  if (degree === -1) return null;
  return scale[(degree + DEGREE_OFFSET[interval]) % scale.length];
}

// Scale-degree names by semitones above the root. The tritone is named #4.
export const DEGREE_LABELS = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'] as const;
export type Degree = typeof DEGREE_LABELS[number];

// The chromatic flavours of each generic interval, measured from a root.
export const CHROMATIC_INTERVALS: Record<Interval, Array<{ label: string; semis: number }>> = {
  '2nd': [{ label: 'b2', semis: 1 }, { label: '2', semis: 2 }],
  '3rd': [{ label: 'b3', semis: 3 }, { label: '3', semis: 4 }],
  '4th': [{ label: '4', semis: 5 }, { label: '#4', semis: 6 }],
  '5th': [{ label: 'b5', semis: 6 }, { label: '5', semis: 7 }],
  '6th': [{ label: 'b6', semis: 8 }, { label: '6', semis: 9 }],
  '7th': [{ label: 'b7', semis: 10 }, { label: '7', semis: 11 }]
};

export function transpose(note: Note, semis: number): Note {
  return CHROMATIC[(((CHROMATIC.indexOf(note) + semis) % 12) + 12) % 12];
}

// The degree `note` is in the key of `root`, e.g. degreeOf('D', 'C') === 'b7'.
export function degreeOf(root: Note, note: Note): Degree {
  return DEGREE_LABELS[(CHROMATIC.indexOf(note) - CHROMATIC.indexOf(root) + 12) % 12];
}
