import { describe, it, expect } from 'vitest';
import { CHROMATIC, NOTE_DISPLAY, noteAt, allPositionsOf, closestPositionOf } from './notes';
import { STANDARD_TUNING } from './tuning';

describe('CHROMATIC', () => {
  it('has 12 distinct notes starting at C', () => {
    expect(CHROMATIC.length).toBe(12);
    expect(CHROMATIC[0]).toBe('C');
    expect(new Set(CHROMATIC).size).toBe(12);
  });
});

describe('NOTE_DISPLAY', () => {
  it('has an entry for every chromatic note', () => {
    for (const n of CHROMATIC) {
      expect(NOTE_DISPLAY[n]).toBeTruthy();
    }
  });
  it('shows enharmonic pairs for accidentals', () => {
    expect(NOTE_DISPLAY['A#']).toBe('A♯/B♭');
    expect(NOTE_DISPLAY['F#']).toBe('F♯/G♭');
    expect(NOTE_DISPLAY['A']).toBe('A');
  });
});

describe('STANDARD_TUNING', () => {
  it('has high E on string 1 and low E on string 6', () => {
    expect(STANDARD_TUNING[1]).toBe('E');
    expect(STANDARD_TUNING[2]).toBe('B');
    expect(STANDARD_TUNING[3]).toBe('G');
    expect(STANDARD_TUNING[4]).toBe('D');
    expect(STANDARD_TUNING[5]).toBe('A');
    expect(STANDARD_TUNING[6]).toBe('E');
  });
});

describe('noteAt', () => {
  it('returns the open-string note at fret 0', () => {
    expect(noteAt(5, 0)).toBe('A');
    expect(noteAt(1, 0)).toBe('E');
    expect(noteAt(6, 0)).toBe('E');
  });
  it('wraps through the chromatic scale', () => {
    expect(noteAt(5, 12)).toBe('A');
    expect(noteAt(3, 2)).toBe('A');
    expect(noteAt(4, 7)).toBe('A');
    expect(noteAt(1, 5)).toBe('A');
    expect(noteAt(6, 5)).toBe('A');
  });
  it('throws on out-of-range string', () => {
    expect(() => noteAt(0 as never, 0)).toThrow();
    expect(() => noteAt(7 as never, 0)).toThrow();
  });
  it('throws on out-of-range fret', () => {
    expect(() => noteAt(1, -1)).toThrow();
  });
});

describe('allPositionsOf', () => {
  it('finds all A positions on a 22-fret board (standard tuning)', () => {
    const positions = allPositionsOf('A', 22);
    // A appears at fret 5 & 17 on strings 1 and 6, fret 10 & 22 on string 2,
    // fret 2 & 14 on string 3, fret 7 & 19 on string 4, fret 0 & 12 on string 5.
    // Total: 12.
    expect(positions).toHaveLength(12);
    expect(positions).toContainEqual({ string: 5, fret: 0 });
    expect(positions).toContainEqual({ string: 5, fret: 12 });
    expect(positions).toContainEqual({ string: 3, fret: 2 });
    expect(positions).toContainEqual({ string: 1, fret: 17 });
    expect(positions).toContainEqual({ string: 6, fret: 5 });
    expect(positions).toContainEqual({ string: 2, fret: 22 });
  });
  it('returns an empty array if maxFret is too small to contain the note', () => {
    // C is not an open-string note in standard tuning. With maxFret=0 the
    // loop runs only at f=0 and finds no C.
    const cs = allPositionsOf('C', 0);
    expect(cs).toEqual([]);
  });
});

describe('closestPositionOf (fret-first, default)', () => {
  it('returns the position itself when the from-position is the target', () => {
    const result = closestPositionOf('A', { string: 5, fret: 0 }, 22);
    expect(result).toEqual([{ string: 5, fret: 0 }]);
  });

  it('prefers a same-fret cross-string move over moving along the neck', () => {
    // From high-E open (string 1, fret 0). Target A.
    //   string 5 fret 0:  Δfret=0, Δstring=4  ← minimum on fret distance
    //   string 3 fret 2:  Δfret=2, Δstring=2
    //   string 1 fret 5:  Δfret=5, Δstring=0
    // Fret-first picks string 5 fret 0 outright (no Manhattan tie with G2).
    const result = closestPositionOf('A', { string: 1, fret: 0 }, 22);
    expect(result).toEqual([{ string: 5, fret: 0 }]);
  });

  it('prefers the same string when fret distances are equal across moves', () => {
    // From string 6 fret 6 (A#). A at string 6 fret 5 has Δfret=1, Δstring=0;
    // A at string 1 fret 5 has Δfret=1, Δstring=5. Same-string wins on Δstring.
    const result = closestPositionOf('A', { string: 6, fret: 6 }, 24);
    expect(result).toEqual([{ string: 6, fret: 5 }]);
  });

  it('returns all tied positions when fret AND string distances are equal', () => {
    // From string 4 fret 1. Δfret=1 candidates for A:
    //   string 3 fret 2: Δfret=1, Δstring=1
    //   string 5 fret 0: Δfret=1, Δstring=1
    // Both keys equal — both returned.
    const result = closestPositionOf('A', { string: 4, fret: 1 }, 22);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ string: 3, fret: 2 });
    expect(result).toContainEqual({ string: 5, fret: 0 });
  });

  it('respects maxFret bound (never returns a position beyond maxFret)', () => {
    // With maxFret=4, A only appears at (s5, f0) and (s3, f2).
    for (let s = 1; s <= 6; s++) {
      for (let f = 0; f <= 4; f++) {
        const result = closestPositionOf('A', { string: s as 1|2|3|4|5|6, fret: f }, 4);
        expect(result.length).toBeGreaterThan(0);
        for (const p of result) {
          expect(p.fret).toBeLessThanOrEqual(4);
          expect([0, 2]).toContain(p.fret);
        }
      }
    }
  });
});

describe('closestPositionOf (manhattan)', () => {
  it('finds the closest A from string 3 fret 7 (D position) — string 4 fret 7', () => {
    const result = closestPositionOf('A', { string: 3, fret: 7 }, 22, 'manhattan');
    expect(result).toEqual([{ string: 4, fret: 7 }]);
  });

  it('returns all tied positions on a true Manhattan tie', () => {
    // From string 4 fret 5 (G). Candidates at Manhattan = 2:
    //   string 4 fret 7: |7-5| + |4-4| = 2
    //   string 6 fret 5: |5-5| + |6-4| = 2
    const result = closestPositionOf('A', { string: 4, fret: 5 }, 22, 'manhattan');
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ string: 4, fret: 7 });
    expect(result).toContainEqual({ string: 6, fret: 5 });
  });

  it('reaches string 5 fret 24 on a 24-fret board near the high end', () => {
    const result = closestPositionOf('A', { string: 6, fret: 23 }, 24, 'manhattan');
    expect(result).toEqual([{ string: 5, fret: 24 }]);
  });

  it('treats high-E fret 0 → A as a tie (A open and G fret 2)', () => {
    // Both have Manhattan distance 4 from (s=1, f=0). This is exactly the
    // case the fret-first algorithm resolves in favor of A-open.
    const result = closestPositionOf('A', { string: 1, fret: 0 }, 22, 'manhattan');
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ string: 5, fret: 0 });
    expect(result).toContainEqual({ string: 3, fret: 2 });
  });
});
