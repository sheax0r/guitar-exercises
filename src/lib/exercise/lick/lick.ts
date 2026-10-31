// Lick helpers: URL encoding, guitar-range fitting and fretting a line from a start string.
import { chordFrets, midiToFret, type Fretted } from '../../transcribe/fretting';
import { STANDARD_TUNING_MIDI, type StringNum } from '../../music/tuning';
import type { Pos } from '../../music/caged';

export const MAX_LICK_NOTES = 16;
// One URL-safe char per note: MIDI 28..91 (the guitar's 40..88 with room either side).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOW = 28;

export const encodeLick = (midis: number[]): string => midis.map(m => ALPHABET[m - LOW]).join('');

export function decodeLick(s: string | null): number[] | null {
  if (!s || s.length > MAX_LICK_NOTES) return null;
  const out = [...s].map(c => ALPHABET.indexOf(c));
  return out.includes(-1) ? null : out.map(i => i + LOW);
}

// Shift a whole line by octaves into the guitar's range (E2..E6) where it fits.
export function fitGuitar(midis: number[]): number[] {
  let k = 0;
  while (Math.min(...midis) + k < 40) k += 12;
  while (Math.max(...midis) + k > 88 && Math.min(...midis) + k - 12 >= 40) k -= 12;
  return midis.map(m => m + k);
}

// Fret a line in one position: the first note at `first`, each other note on whichever
// string keeps it nearest that fret (fretting.ts's voicing rule). Null if it doesn't fit.
function fretLine(midis: number[], first: Fretted, maxFret: number): Pos[] | null {
  if (first.fret > maxFret) return null;
  const out: Pos[] = [{ string: first.str, fret: first.fret }];
  for (const m of midis.slice(1)) {
    const f = chordFrets([m], first.fret)[0];
    if (!f || f.fret > maxFret) return null;
    out.push({ string: f.str, fret: f.fret });
  }
  return out;
}

// Place a line on the neck, starting on `startString` (null = lowest-fret position). Tries
// the given octave first, then an octave down/up, then two.
export function placeLick(midis: number[], startString: StringNum | null, maxFret: number): { notes: number[]; pos: Pos[] } | null {
  for (const oct of [0, -12, 12, -24, 24]) {
    const notes = midis.map(m => m + oct);
    let first: Fretted | null;
    if (startString) {
      const fret = notes[0] - STANDARD_TUNING_MIDI[startString];
      first = fret >= 0 ? { str: startString, fret } : null;
    } else {
      first = midiToFret(notes[0]);
    }
    const pos = first && fretLine(notes, first, maxFret);
    if (pos) return { notes, pos };
  }
  return null;
}
