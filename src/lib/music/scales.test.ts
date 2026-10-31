import { describe, it, expect } from 'vitest';
import { scaleNotes, diatonicInterval, CHROMATIC_INTERVALS, INTERVAL_ORDER, transpose, degreeOf, DEGREE_LABELS } from './scales';

describe('scaleNotes', () => {
  it('builds the C major scale', () => {
    expect(scaleNotes('C', 'major')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });

  it('builds the A natural minor scale', () => {
    expect(scaleNotes('A', 'minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });

  it('builds a scale with accidentals (G major)', () => {
    expect(scaleNotes('G', 'major')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
  });
});

describe('diatonicInterval', () => {
  it('finds the diatonic 3rd above the tonic (major 3rd)', () => {
    expect(diatonicInterval('C', 'major', 'C', '3rd')).toBe('E');
  });

  it('finds a diatonic 3rd that is minor (3rd of D in C major is F)', () => {
    expect(diatonicInterval('C', 'major', 'D', '3rd')).toBe('F');
  });

  it('finds the diatonic 5th above the tonic', () => {
    expect(diatonicInterval('C', 'major', 'C', '5th')).toBe('G');
  });

  it('wraps the 5th around the octave (5th of B in C major is F)', () => {
    expect(diatonicInterval('C', 'major', 'B', '5th')).toBe('F');
  });

  it('works in a minor key (3rd of A in A minor is C)', () => {
    expect(diatonicInterval('A', 'minor', 'A', '3rd')).toBe('C');
  });

  it('returns null when the note is not in the scale', () => {
    expect(diatonicInterval('C', 'major', 'C#', '3rd')).toBeNull();
  });
});

describe('wider diatonic intervals', () => {
  it('2nd, 4th, 6th and 7th in C major', () => {
    expect(diatonicInterval('C', 'major', 'E', '2nd')).toBe('F');
    expect(diatonicInterval('C', 'major', 'F', '4th')).toBe('B');
    expect(diatonicInterval('C', 'major', 'C', '6th')).toBe('A');
    expect(diatonicInterval('C', 'major', 'D', '7th')).toBe('C');
  });
});

describe('chromatic degrees', () => {
  it('each generic interval has a flat and a natural/sharp flavour, all distinct labels', () => {
    for (const i of INTERVAL_ORDER) expect(CHROMATIC_INTERVALS[i]).toHaveLength(2);
    expect(CHROMATIC_INTERVALS['7th'].map(x => x.semis)).toEqual([10, 11]);
  });
  it('transpose and degreeOf', () => {
    expect(transpose('D', 10)).toBe('C');
    expect(transpose('C', -1)).toBe('B');
    expect(degreeOf('D', 'C')).toBe('b7');
    expect(degreeOf('C', 'F#')).toBe('#4');
    expect(degreeOf('A', 'A')).toBe('1');
    expect(DEGREE_LABELS).toHaveLength(12);
  });
});
