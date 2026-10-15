import { noteAt, pitchOf, type Fret, type Note } from '../../music/notes';
import type { StringNum } from '../../music/tuning';
import { scaleNotes, MODE_OFFSETS, type Mode } from '../../music/modes';

export type Pos = { string: StringNum; fret: Fret };

// The eight ascending absolute pitches of a one-octave run: the root pitch,
// then each of the six scale degrees above it, then the octave root (+12).
export function octaveSequencePitches(root: Pos, mode: Mode): number[] {
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
export function octaveFixedPositions(root: Pos, mode: Mode, maxFret: Fret): Pos[] | null {
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

// Every position inside the box window whose pitch-class is in the mode.
export function boxPositions(root: Pos, mode: Mode, maxFret: Fret, span: number): Pos[] {
  const [start, end] = boxWindow(root.fret, maxFret, span);
  const rootNote = noteAt(root.string, root.fret);
  const classes = new Set<Note>(scaleNotes(rootNote, mode));
  const out: Pos[] = [];
  for (let s = 1 as StringNum; s <= 6; s = (s + 1) as StringNum) {
    for (let f = start; f <= end; f++) {
      if (classes.has(noteAt(s, f))) out.push({ string: s, fret: f });
    }
  }
  return out;
}
