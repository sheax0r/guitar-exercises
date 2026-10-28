import { describe, it, expect } from 'vitest';
import {
  octaveSequencePitches,
  octaveFixedPositions,
  boxWindow,
  boxPositions,
  scaleFretboardPositions,
  sampleByPercentage
} from './shape';
import { pitchOf, noteAt } from '../../music/notes';
import { scaleNotes } from '../../music/modes';
import type { StringNum } from '../../music/tuning';
import type { Pos } from './shape';

const P = (string: number, fret: number): Pos => ({ string: string as StringNum, fret });

describe('octaveSequencePitches', () => {
  it('ionian from low E open spans root..octave (8 notes)', () => {
    const seq = octaveSequencePitches(P(6, 0), 'ionian');
    expect(seq).toEqual([40, 42, 44, 45, 47, 49, 51, 52]);
  });
  it('dorian ends an octave (12 semitones) above the root', () => {
    const seq = octaveSequencePitches(P(5, 5), 'dorian');
    expect(seq[seq.length - 1] - seq[0]).toBe(12);
  });
});

describe('octaveFixedPositions', () => {
  it('returns one position per sequence pitch, pitches matching the sequence', () => {
    const root = P(6, 5); // A
    const seq = octaveSequencePitches(root, 'ionian');
    const pos = octaveFixedPositions(root, 'ionian', 24)!;
    expect(pos).toHaveLength(seq.length);
    expect(pos[0]).toEqual(root);
    expect(pos.map(p => pitchOf(p.string, p.fret))).toEqual(seq);
  });
  it('is deterministic', () => {
    const a = octaveFixedPositions(P(6, 5), 'dorian', 24);
    const b = octaveFixedPositions(P(6, 5), 'dorian', 24);
    expect(a).toEqual(b);
  });
  it('returns null when the octave cannot fit within maxFret', () => {
    // root on high e (string 1): the octave (+12) needs fret 12 on the same
    // string and there is no higher string; maxFret 5 makes it unreachable.
    expect(octaveFixedPositions(P(1, 0), 'ionian', 5)).toBeNull();
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
    const root = P(6, 5); // A, A dorian
    const set = boxPositions(root, 'dorian', 24, 4);
    expect(set.length).toBeGreaterThan(0);
    for (const p of set) {
      expect(p.fret).toBeGreaterThanOrEqual(5);
      expect(p.fret).toBeLessThanOrEqual(8);
    }
    expect(set).toContainEqual(root);
  });
});

describe('scaleFretboardPositions', () => {
  it('returns every neck position whose note is in the scale', () => {
    const root = P(6, 5); // A ionian
    const classes = new Set(scaleNotes('A', 'ionian'));
    const set = scaleFretboardPositions(root, 'ionian', 12);
    expect(set.length).toBeGreaterThan(0);
    for (const p of set) expect(classes.has(noteAt(p.string, p.fret))).toBe(true);
    // Covers the whole neck, not just a window.
    expect(set.some(p => p.fret <= 2)).toBe(true);
    expect(set.some(p => p.fret >= 10)).toBe(true);
  });
});

describe('sampleByPercentage', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  it('keeps all at 100 and none at 0', () => {
    expect(sampleByPercentage(items, 100)).toHaveLength(20);
    expect(sampleByPercentage(items, 0)).toHaveLength(0);
  });
  it('keeps a rounded share and only members of the input', () => {
    const got = sampleByPercentage(items, 25);
    expect(got).toHaveLength(5);
    for (const g of got) expect(items).toContain(g);
    expect(new Set(got).size).toBe(got.length); // no duplicates
  });
  it('clamps out-of-range percentages and leaves the input untouched', () => {
    const copy = items.slice();
    expect(sampleByPercentage(items, 150)).toHaveLength(20);
    expect(sampleByPercentage(items, -10)).toHaveLength(0);
    expect(items).toEqual(copy);
  });
});
