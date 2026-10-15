import { describe, it, expect } from 'vitest';
import { scaleNotes, diatonicInterval } from './scales';

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
