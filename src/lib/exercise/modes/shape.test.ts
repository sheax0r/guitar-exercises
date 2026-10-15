import { describe, it, expect } from 'vitest';
import {
  octaveSequencePitches,
  octaveFixedPositions,
  boxWindow,
  boxPositions
} from './shape';
import { pitchOf } from '../../music/notes';

describe('octaveSequencePitches', () => {
  it('ionian from low E open spans root..octave (8 notes)', () => {
    const seq = octaveSequencePitches({ string: 6, fret: 0 }, 'ionian');
    expect(seq).toEqual([40, 42, 44, 45, 47, 49, 51, 52]);
  });
  it('dorian ends an octave (12 semitones) above the root', () => {
    const seq = octaveSequencePitches({ string: 5, fret: 5 }, 'dorian');
    expect(seq[seq.length - 1] - seq[0]).toBe(12);
  });
});

describe('octaveFixedPositions', () => {
  it('returns one position per sequence pitch, pitches matching the sequence', () => {
    const root = { string: 6, fret: 5 }; // A
    const seq = octaveSequencePitches(root, 'ionian');
    const pos = octaveFixedPositions(root, 'ionian', 24)!;
    expect(pos).toHaveLength(seq.length);
    expect(pos[0]).toEqual(root);
    expect(pos.map(p => pitchOf(p.string, p.fret))).toEqual(seq);
  });
  it('is deterministic', () => {
    const a = octaveFixedPositions({ string: 6, fret: 5 }, 'dorian', 24);
    const b = octaveFixedPositions({ string: 6, fret: 5 }, 'dorian', 24);
    expect(a).toEqual(b);
  });
  it('returns null when the octave cannot fit within maxFret', () => {
    // root on high e (string 1): the octave (+12) needs fret 12 on the same
    // string and there is no higher string; maxFret 5 makes it unreachable.
    expect(octaveFixedPositions({ string: 1, fret: 0 }, 'ionian', 5)).toBeNull();
  });
});

describe('boxWindow', () => {
  it('anchors at the root fret', () => {
    expect(boxWindow(5, 24, 4)).toEqual([5, 8]);
  });
  it('shifts left so the window fits within maxFret', () => {
    expect(boxWindow(23, 24, 4)).toEqual([21, 24]);
  });
  it('never starts below 0', () => {
    expect(boxWindow(0, 24, 4)).toEqual([0, 3]);
  });
});

describe('boxPositions', () => {
  it('returns only in-window scale positions, root included', () => {
    const root = { string: 6, fret: 5 }; // A, A dorian
    const set = boxPositions(root, 'dorian', 24, 4);
    expect(set.length).toBeGreaterThan(0);
    for (const p of set) {
      expect(p.fret).toBeGreaterThanOrEqual(5);
      expect(p.fret).toBeLessThanOrEqual(8);
    }
    expect(set).toContainEqual(root);
  });
});
