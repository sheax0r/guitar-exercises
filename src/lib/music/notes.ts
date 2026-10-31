import { STANDARD_TUNING, STANDARD_TUNING_MIDI, type StringNum } from './tuning';

export const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
export type Note = typeof CHROMATIC[number];
export type Fret = number;

export const NOTE_DISPLAY: Record<Note, string> = {
  'C': 'C',
  'C#': 'C♯/D♭',
  'D': 'D',
  'D#': 'D♯/E♭',
  'E': 'E',
  'F': 'F',
  'F#': 'F♯/G♭',
  'G': 'G',
  'G#': 'G♯/A♭',
  'A': 'A',
  'A#': 'A♯/B♭',
  'B': 'B'
};

function chromaticIndex(note: Note): number {
  return CHROMATIC.indexOf(note);
}

function assertString(s: number): asserts s is StringNum {
  if (s < 1 || s > 6 || !Number.isInteger(s)) {
    throw new Error(`Invalid string number: ${s}`);
  }
}

function assertFret(f: number): void {
  if (f < 0 || !Number.isInteger(f)) {
    throw new Error(`Invalid fret: ${f}`);
  }
}

// Absolute pitch (MIDI number) of a fretted note. Higher = higher pitch.
export function pitchOf(string: StringNum, fret: Fret): number {
  assertString(string);
  assertFret(fret);
  return STANDARD_TUNING_MIDI[string] + fret;
}

export function noteAt(string: StringNum, fret: Fret): Note {
  assertString(string);
  assertFret(fret);
  const open = STANDARD_TUNING[string];
  const idx = (chromaticIndex(open) + fret) % CHROMATIC.length;
  return CHROMATIC[idx];
}

export function allPositionsOf(note: Note, maxFret: Fret): Array<{ string: StringNum; fret: Fret }> {
  assertFret(maxFret);
  const result: Array<{ string: StringNum; fret: Fret }> = [];
  for (let s = 1 as StringNum; s <= 6; s = (s + 1) as StringNum) {
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(s, f) === note) {
        result.push({ string: s, fret: f });
      }
    }
  }
  return result;
}

export type ClosestAlgorithm = 'manhattan' | 'fret-first';

// Distance is a lexicographic key: smaller wins, element-by-element.
// 'manhattan'  → [|Δfret| + |Δstring|]                (1-tuple)
// 'fret-first' → [|Δfret|, |Δstring|]                  (2-tuple, fret distance dominates)
function distanceKey(
  algorithm: ClosestAlgorithm,
  a: { string: StringNum; fret: Fret },
  b: { string: StringNum; fret: Fret }
): number[] {
  const df = Math.abs(a.fret - b.fret);
  const ds = Math.abs(a.string - b.string);
  switch (algorithm) {
    case 'manhattan':  return [df + ds];
    case 'fret-first': return [df, ds];
  }
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export type Direction = 'nearest' | 'ascending';

// `target` may be several notes: the nearest occurrence of any of them wins.
export function closestPositionOf(
  target: Note | readonly Note[],
  from: { string: StringNum; fret: Fret },
  maxFret: Fret,
  algorithm: ClosestAlgorithm = 'fret-first',
  direction: Direction = 'nearest'
): Array<{ string: StringNum; fret: Fret }> {
  assertString(from.string);
  assertFret(from.fret);
  const all = (typeof target === 'string' ? [target] : target).flatMap(n => allPositionsOf(n, maxFret));
  if (all.length === 0) {
    throw new Error(`No positions found for note ${target} within maxFret=${maxFret}`);
  }
  // 'ascending' accepts only positions strictly higher in pitch than `from`.
  // ponytail: if none are higher within maxFret (player is near the top of the
  // neck), fall back to the overall-nearest so the prompt stays answerable.
  const fromPitch = pitchOf(from.string, from.fret);
  const higher = direction === 'ascending'
    ? all.filter(p => pitchOf(p.string, p.fret) > fromPitch)
    : all;
  const candidates = higher.length > 0 ? higher : all;
  let bestKey = distanceKey(algorithm, candidates[0], from);
  let best: Array<{ string: StringNum; fret: Fret }> = [candidates[0]];
  for (let i = 1; i < candidates.length; i++) {
    const key = distanceKey(algorithm, candidates[i], from);
    const cmp = compareKeys(key, bestKey);
    if (cmp < 0) {
      bestKey = key;
      best = [candidates[i]];
    } else if (cmp === 0) {
      best.push(candidates[i]);
    }
  }
  return best;
}
