import { describe, it, expect } from 'vitest';
import { scaleNotes, MODE_OFFSETS, MODE_ORDER, MODE_DISPLAY, MODE_CHARACTERISTIC, characteristicNote, SCALE_ORDER, scaleFamily } from './modes';

describe('modes', () => {
  it('C ionian is the C major scale', () => {
    expect(scaleNotes('C', 'ionian')).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });
  it('D dorian has no accidentals (relative to C major)', () => {
    expect(scaleNotes('D', 'dorian')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  });
  it('E phrygian', () => {
    expect(scaleNotes('E', 'phrygian')).toEqual(['E', 'F', 'G', 'A', 'B', 'C', 'D']);
  });
  it('A aeolian is natural minor', () => {
    expect(scaleNotes('A', 'aeolian')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
  it('G mixolydian has a flat 7 (F natural)', () => {
    expect(scaleNotes('G', 'mixolydian')).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F']);
  });
  it('each mode has 7 offsets starting at 0', () => {
    for (const m of MODE_ORDER) {
      expect(MODE_OFFSETS[m]).toHaveLength(7);
      expect(MODE_OFFSETS[m][0]).toBe(0);
    }
  });
  it('MODE_ORDER lists all seven modes', () => {
    expect(MODE_ORDER).toHaveLength(7);
  });
  it('display names are capitalized', () => {
    expect(MODE_DISPLAY.dorian).toBe('Dorian');
    expect(MODE_DISPLAY.mixolydian).toBe('Mixolydian');
  });
  it('characteristic offsets match the defining altered degree', () => {
    expect(MODE_CHARACTERISTIC.lydian).toBe(6);      // #4
    expect(MODE_CHARACTERISTIC.dorian).toBe(9);      // nat 6
    expect(MODE_CHARACTERISTIC.mixolydian).toBe(10); // b7
    expect(MODE_CHARACTERISTIC.phrygian).toBe(1);    // b2
    expect(MODE_CHARACTERISTIC.locrian).toBe(6);     // b5
    expect(MODE_CHARACTERISTIC.aeolian).toBe(8);     // b6
    expect(MODE_CHARACTERISTIC.ionian).toBe(11);     // maj7
  });
  it('characteristicNote maps the offset through the root', () => {
    expect(characteristicNote('C', 'lydian')).toBe('F#');
    expect(characteristicNote('C', 'dorian')).toBe('A');
    expect(characteristicNote('C', 'mixolydian')).toBe('A#'); // Bb
    expect(characteristicNote('G', 'mixolydian')).toBe('F');  // G mixo b7 = F
  });
});

describe('scale types beyond the modes', () => {
  it('spells the new scales', () => {
    expect(scaleNotes('C', 'major-pentatonic')).toEqual(['C', 'D', 'E', 'G', 'A']);
    expect(scaleNotes('A', 'minor-pentatonic')).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(scaleNotes('A', 'blues')).toEqual(['A', 'C', 'D', 'D#', 'E', 'G']);
    expect(scaleNotes('A', 'harmonic-minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
    expect(scaleNotes('A', 'melodic-minor')).toEqual(['A', 'B', 'C', 'D', 'E', 'F#', 'G#']);
  });
  it('SCALE_ORDER is the seven modes then the five new scales, all displayable', () => {
    expect(SCALE_ORDER.slice(0, 7)).toEqual(MODE_ORDER);
    expect(SCALE_ORDER).toHaveLength(12);
    for (const s of SCALE_ORDER) {
      expect(MODE_DISPLAY[s]).toBeTruthy();
      expect(MODE_OFFSETS[s][0]).toBe(0);
      // the characteristic degree is in the scale
      expect(MODE_OFFSETS[s]).toContain(MODE_CHARACTERISTIC[s]);
    }
  });
  it('scaleFamily: major if it has a major 3rd, else minor', () => {
    expect(scaleFamily('ionian')).toBe('major');
    expect(scaleFamily('mixolydian')).toBe('major');
    expect(scaleFamily('major-pentatonic')).toBe('major');
    expect(scaleFamily('dorian')).toBe('minor');
    expect(scaleFamily('blues')).toBe('minor');
    expect(scaleFamily('melodic-minor')).toBe('minor');
  });
});
