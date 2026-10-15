import { CHROMATIC, type Note } from './notes';

export type ScaleQuality = 'major' | 'minor';
export type Interval = '3rd' | '5th';

// Semitone offsets from the tonic. 'minor' is the natural minor (Aeolian).
const STEPS: Record<ScaleQuality, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10]
};

// Scale degrees to add for each interval (0-indexed: a "3rd" is two degrees up).
const DEGREE_OFFSET: Record<Interval, number> = {
  '3rd': 2,
  '5th': 4
};

export function scaleNotes(root: Note, quality: ScaleQuality): Note[] {
  const rootIdx = CHROMATIC.indexOf(root);
  return STEPS[quality].map(step => CHROMATIC[(rootIdx + step) % CHROMATIC.length]);
}

// The diatonic 3rd or 5th above `note` within the given key, or null if `note`
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
