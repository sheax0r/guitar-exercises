import { noteAt, pitchOf, type Fret, type Note } from '../../music/notes';
import type { StringNum } from '../../music/tuning';
import { scaleNotes, scaleFamily, MODE_OFFSETS, type ScaleType } from '../../music/modes';
import { cagedInstances, CAGED_SCALE_WINDOWS, type CagedShape, type CagedInstance } from '../../music/caged';

export type Pos = { string: StringNum; fret: Fret };

// The eight ascending absolute pitches of a one-octave run: the root pitch,
// then each of the six scale degrees above it, then the octave root (+12).
export function octaveSequencePitches(root: Pos, mode: ScaleType): number[] {
  const p0 = pitchOf(root.string, root.fret);
  const offsets = MODE_OFFSETS[mode];
  const pitches = offsets.map(o => p0 + o);
  pitches.push(p0 + 12);
  return pitches;
}

// All positions within [0, maxFret] whose absolute pitch equals `pitch`.
function positionsAtPitch(pitch: number, maxFret: Fret): Pos[] {
  const out: Pos[] = [];
  for (let s = 1 as StringNum; s <= 6; s = (s + 1) as StringNum) {
    for (let f = 0; f <= maxFret; f++) {
      if (pitchOf(s, f) === pitch) out.push({ string: s, fret: f });
    }
  }
  return out;
}

// One canonical position per sequence pitch, forming a connected climbing
// shape: starting at the root, each next pitch is placed at the candidate that
// minimises (|string - prevString|, fret) — stay near the current string, then
// prefer the lower fret. Returns null if any pitch is unreachable within
// maxFret (the prompt generator rejects such roots).
export function octaveFixedPositions(root: Pos, mode: ScaleType, maxFret: Fret): Pos[] | null {
  const seq = octaveSequencePitches(root, mode);
  const result: Pos[] = [root];
  let prev = root;
  for (let i = 1; i < seq.length; i++) {
    const candidates = positionsAtPitch(seq[i], maxFret);
    if (candidates.length === 0) return null;
    let best = candidates[0];
    let bestKey: [number, number] = [Math.abs(best.string - prev.string), best.fret];
    for (let c = 1; c < candidates.length; c++) {
      const cand = candidates[c];
      const key: [number, number] = [Math.abs(cand.string - prev.string), cand.fret];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = cand;
        bestKey = key;
      }
    }
    result.push(best);
    prev = best;
  }
  return result;
}

// The fret window for a box shape: `span` frets anchored at the root fret,
// shifted left so it always fits within [0, maxFret].
export function boxWindow(rootFret: Fret, maxFret: Fret, span: number): [number, number] {
  const start = Math.max(0, Math.min(rootFret, maxFret - span + 1));
  const end = Math.min(maxFret, start + span - 1);
  return [start, end];
}

// Every position on the whole neck (within [0, maxFret]) whose pitch-class is in
// the mode rooted at `root` — the scale as it falls across the fretboard. Used
// as the optional study overlay; roots are included (they are degree 0).
export function scaleFretboardPositions(root: Pos, mode: ScaleType, maxFret: Fret): Pos[] {
  const rootNote = noteAt(root.string, root.fret);
  const classes = new Set<Note>(scaleNotes(rootNote, mode));
  const out: Pos[] = [];
  for (let s = 1 as StringNum; s <= 6; s = (s + 1) as StringNum) {
    for (let f = 0; f <= maxFret; f++) {
      if (classes.has(noteAt(s, f))) out.push({ string: s, fret: f });
    }
  }
  return out;
}

// Keep a random `percentage`% of `items` (0..100, clamped; kept count rounded).
// Fisher–Yates over a copy, so the input is untouched and the kept subset is a
// uniform random snapshot — call once per prompt to keep it stable while shown.
export function sampleByPercentage<T>(items: T[], percentage: number): T[] {
  const pct = Math.max(0, Math.min(100, percentage));
  const keep = Math.round((items.length * pct) / 100);
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, keep);
}

// Every position inside the box window whose pitch-class is in the mode.
export function boxPositions(root: Pos, mode: ScaleType, maxFret: Fret, span: number): Pos[] {
  return windowPositions(noteAt(root.string, root.fret), mode, boxWindow(root.fret, maxFret, span));
}

// Every position inside [start, end] whose pitch-class is in the scale.
export function windowPositions(rootNote: Note, mode: ScaleType, [start, end]: [number, number]): Pos[] {
  const classes = new Set<Note>(scaleNotes(rootNote, mode));
  const out: Pos[] = [];
  for (let s = 1 as StringNum; s <= 6; s = (s + 1) as StringNum) {
    for (let f = start; f <= end; f++) {
      if (classes.has(noteAt(s, f))) out.push({ string: s, fret: f });
    }
  }
  return out;
}

// Every placement of the scale's `shape` position for `rootNote` within
// maxFret, using the major or minor CAGED scale window for the scale's family.
export function cagedScaleInstances(shape: CagedShape, rootNote: Note, mode: ScaleType, maxFret: Fret): CagedInstance[] {
  return cagedInstances(shape, rootNote, maxFret, CAGED_SCALE_WINDOWS[scaleFamily(mode)][shape]);
}
