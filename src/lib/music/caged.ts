import { CHROMATIC, noteAt, type Note } from './notes';
import type { StringNum } from './tuning';

export type CagedShape = 'C' | 'A' | 'G' | 'E' | 'D';
export const CAGED_ORDER: CagedShape[] = ['C', 'A', 'G', 'E', 'D'];

// A shape is a fret window anchored on a root string: [lo, hi] frets relative
// to the root's fret. Its notes are every chord tone inside the window.
export const CAGED_SHAPES: Record<CagedShape, { rootString: StringNum; lo: number; hi: number }> = {
  C: { rootString: 5, lo: -3, hi: 0 },
  A: { rootString: 5, lo: 0, hi: 2 },
  G: { rootString: 6, lo: -3, hi: 0 },
  E: { rootString: 6, lo: 0, hi: 2 },
  D: { rootString: 4, lo: 0, hi: 3 }
};

// Scale positions hang off the same shapes but span a little wider than the
// chord: these windows reproduce the five textbook pentatonic boxes (major
// pentatonic off the major shapes, minor pentatonic off the minor shapes), and
// any other scale of that family fills the same frets.
export const CAGED_SCALE_WINDOWS: Record<'major' | 'minor', Record<CagedShape, { lo: number; hi: number }>> = {
  major: { C: { lo: -3, hi: 0 }, A: { lo: -1, hi: 2 }, G: { lo: -3, hi: 0 }, E: { lo: -1, hi: 2 }, D: { lo: -1, hi: 3 } },
  minor: { C: { lo: -3, hi: 1 }, A: { lo: 0, hi: 3 }, G: { lo: -3, hi: 0 }, E: { lo: 0, hi: 3 }, D: { lo: 0, hi: 3 } }
};

export type ChordQuality = 'major' | 'minor';
export type ChordType = 'maj' | 'min' | 'maj7' | '7' | 'm7';

export const CHORD_OFFSETS: Record<ChordType, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10]
};

export const CHORD_DISPLAY: Record<ChordType, string> = {
  maj: 'major', min: 'minor', maj7: 'maj7', '7': '7', m7: 'm7'
};

// "A major", "D minor", "Gmaj7", "E7", "Bm7".
export function chordName(root: string, type: ChordType): string {
  return type === 'maj' || type === 'min' ? `${root} ${CHORD_DISPLAY[type]}` : `${root}${CHORD_DISPLAY[type]}`;
}

// The chord types drawn for the chosen qualities: triads, or with the 7th on,
// maj7 + dominant 7 for major and m7 for minor.
export function chordTypesFor(qualities: ChordQuality[], include7th: boolean): ChordType[] {
  const out: ChordType[] = [];
  if (qualities.includes('major')) out.push(...(include7th ? (['maj7', '7'] as const) : (['maj'] as const)));
  if (qualities.includes('minor')) out.push(include7th ? 'm7' : 'min');
  return out;
}

export function chordNotes(root: Note, type: ChordType): Note[] {
  const r = CHROMATIC.indexOf(root);
  return CHORD_OFFSETS[type].map(o => CHROMATIC[(r + o) % 12]);
}

export type Pos = { string: StringNum; fret: number };
export interface CagedInstance {
  shape: CagedShape;
  root: Pos;               // the anchoring root on the shape's root string
  window: [number, number];
}

// Every placement of `shape` for `root` that fits within [0, maxFret], lowest
// first. A window that would start below fret 0 only appears an octave up.
// `win` overrides the chord window (e.g. with a CAGED_SCALE_WINDOWS entry).
export function cagedInstances(
  shape: CagedShape,
  root: Note,
  maxFret: number,
  win: { lo: number; hi: number } = CAGED_SHAPES[shape]
): CagedInstance[] {
  const { rootString } = CAGED_SHAPES[shape];
  const { lo, hi } = win;
  let base = 0;
  while (noteAt(rootString, base) !== root) base++;
  const out: CagedInstance[] = [];
  for (let f = base; f + hi <= maxFret; f += 12) {
    if (f + lo < 0) continue;
    out.push({ shape, root: { string: rootString, fret: f }, window: [f + lo, f + hi] });
  }
  return out;
}

// Every position inside the window whose pitch class is a chord tone.
export function chordPositions(root: Note, type: ChordType, window: [number, number]): Pos[] {
  const tones = new Set(chordNotes(root, type));
  const out: Pos[] = [];
  for (let s = 1 as StringNum; s <= 6; s = (s + 1) as StringNum) {
    for (let f = window[0]; f <= window[1]; f++) {
      if (tones.has(noteAt(s, f))) out.push({ string: s, fret: f });
    }
  }
  return out;
}

export function nextShape(shape: CagedShape): CagedShape {
  return CAGED_ORDER[(CAGED_ORDER.indexOf(shape) + 1) % CAGED_ORDER.length];
}

// The next shape in the C-A-G-E-D cycle, placed up the neck from `inst`: its
// lowest placement whose window starts above inst's. null if none fits.
export function nextShapeInstance(inst: CagedInstance, root: Note, maxFret: number): CagedInstance | null {
  return cagedInstances(nextShape(inst.shape), root, maxFret).find(i => i.window[0] > inst.window[0]) ?? null;
}
