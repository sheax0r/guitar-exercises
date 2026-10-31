// Reference melodies. semi = semitones relative to the first note, beats = duration (quarter = 1 beat).
import type { TabNote } from '../types';

export interface Song {
  title: string;
  num: number;
  den: number;
  pickup: number;
  notes: Array<{ semi: number; beats: number }>;
}

// Happy Birthday (Hill sisters, 1893; public domain): 3/4, one-beat pickup ("Hap-py") in the
// common dotted-eighth + sixteenth rhythm. In C, starting on G.
const G = 0, A = 2, B = 4, C2 = 5, D2 = 7, E2 = 9, F2 = 10, G2 = 12;
export const HAPPY_BIRTHDAY: Song = {
  title: 'Happy Birthday',
  num: 3,
  den: 4,
  pickup: 1,
  notes: (
    [
      [G, 0.75], [G, 0.25], // Hap-py
      [A, 1], [G, 1], [C2, 1], // birth-day to
      [B, 2], [G, 0.75], [G, 0.25], // you, Hap-py
      [A, 1], [G, 1], [D2, 1], // birth-day to
      [C2, 2], [G, 0.75], [G, 0.25], // you, Hap-py
      [G2, 1], [E2, 1], [C2, 1], // birth-day dear
      [B, 1], [A, 1], [F2, 0.75], [F2, 0.25], // Na-me, Hap-py
      [E2, 1], [C2, 1], [D2, 1], // birth-day to
      [C2, 3] // you.
    ] as const
  ).map(([semi, beats]) => ({ semi, beats }))
};

// add pos = onset in beats from the first note
export const withPos = (song: Song) => {
  let p = 0;
  return song.notes.map(n => {
    const o = { ...n, pos: p };
    p += n.beats;
    return o;
  });
};

// Timed notes for buildTex: base = midi of the first note; the pickup lands at the end of an
// otherwise-empty bar 1.
export function songToNotes(song: Song, base: number, bpm: number): TabNote[] {
  const beat = 60 / bpm, lead = (song.num - song.pickup) * beat;
  return withPos(song).map(n => ({ midi: base + n.semi, start: lead + n.pos * beat, dur: n.beats * beat }));
}
