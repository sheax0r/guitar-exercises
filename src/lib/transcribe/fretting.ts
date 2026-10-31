// Pitch -> (string, fret) in standard tuning. String numbers 1..6 = high E..low E, matching
// alphaTex and the <String> values in a GP8 gpif (and music/tuning.ts).
import { CHROMATIC } from '../music/notes';
import { STANDARD_TUNING_MIDI, type StringNum } from '../music/tuning';

export interface Fretted {
  str: StringNum;
  fret: number;
}

const STRINGS: StringNum[] = [1, 2, 3, 4, 5, 6];
const MAX_FRET = 24;

export const noteName = (m: number): string => CHROMATIC[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

// Greedy lowest-fret position, or null when the pitch is off the neck.
export function midiToFret(midi: number): Fretted | null {
  return chordFrets([midi])[0] ?? null;
}

// Assign each pitch to a free string. prevFret null -> greedy lowest fret; else nearest to
// prevFret (voicing: minimize hand travel). Notes that don't fit on a free string are dropped.
// ponytail: greedy nearest-to-prev, not a global shortest path.
export function chordFrets(midis: number[], prevFret: number | null = null): Fretted[] {
  const used = new Set<StringNum>(), out: Fretted[] = [];
  for (const m of [...midis].sort((a, b) => a - b)) {
    let best: { str: StringNum; fret: number; cost: number } | null = null;
    for (const s of STRINGS) {
      if (used.has(s)) continue;
      const fret = m - STANDARD_TUNING_MIDI[s];
      if (fret < 0 || fret > MAX_FRET) continue;
      const cost = prevFret == null ? fret : Math.abs(fret - prevFret);
      if (best === null || cost < best.cost) best = { str: s, fret, cost };
    }
    if (best) {
      used.add(best.str);
      out.push({ str: best.str, fret: best.fret });
    }
  }
  return out;
}
