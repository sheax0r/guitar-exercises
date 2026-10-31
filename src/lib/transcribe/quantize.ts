// Time and pitch quantization: seconds -> 16th-note grid, fractional pitch -> semitones.
import type { RawNote, TabNote } from './types';

export const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
};

// Seconds -> whole 16ths of a quarter note at `bpm`, at least 1.
export const toSixteenths = (sec: number, bpm: number): number =>
  Math.max(1, Math.round(sec / (60 / bpm / 4)));

// ponytail: nearest single base value, no dots/ties. Known ceiling (musical cleanup ties instead).
export const durToken = (n: number): string =>
  n >= 16 ? '1' : n >= 8 ? '2' : n >= 4 ? '4' : n >= 2 ? '8' : '16';

const TOKEN_16THS: Record<string, number> = { '1': 16, '2': 8, '4': 4, '8': 2, '16': 1 };
export const tokSixteenths = (tok: string): number => TOKEN_16THS[tok.split('.').pop()!] || 1;

// Largest valid note value (in 16ths) <= n, min 1 (never 0, so callers' loops end).
export const largestPow2 = (n: number): number => {
  let p = 16;
  while (p > n && p > 1) p >>= 1;
  return p;
};

// The take's own tuning, in semitones [-0.5, 0.5]: duration-weighted circular mean of each
// note's offset from equal temperament. Whistlers often sit between semitones; rounding
// against this (not against one note) keeps intervals right.
export function tuningOffset(raw: RawNote[]): number {
  let x = 0, y = 0;
  for (const n of raw) {
    const a = 2 * Math.PI * (n.midiFloat - Math.round(n.midiFloat)), w = n.dur > 0 ? n.dur : 0;
    x += w * Math.cos(a);
    y += w * Math.sin(a);
  }
  return Math.atan2(y, x) / (2 * Math.PI);
}

// Absolute pitch of the first note, rounded the tuning-aware way mapNotes rounds. The anchor
// when the input's pitch is trusted (guitar, Basic Pitch), so a detuned take doesn't shift
// the whole tab a semitone.
export const firstMidi = (raw: RawNote[]): number => Math.round(raw[0].midiFloat - tuningOffset(raw));

// Raw notes -> tab notes: first note pinned to anchorMidi, the rest keep their interval
// from it. offsetSec shifts onsets (latency compensation).
export function mapNotes(raw: RawNote[], anchorMidi: number, offsetSec = 0): TabNote[] {
  if (!raw.length) return [];
  const tune = tuningOffset(raw), q = (n: RawNote) => Math.round(n.midiFloat - tune), q0 = q(raw[0]);
  return raw.map(n => ({ midi: anchorMidi + q(n) - q0, start: Math.max(0, n.start + offsetSec), dur: n.dur }));
}
