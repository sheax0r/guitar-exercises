import { describe, it, expect } from 'vitest';
import { summarize } from './summary';
import { NOTE_DISPLAY } from '../music/notes';
import { MODE_ORDER } from '../music/modes';
import type { ExerciseConfig } from './types';
import type { PlayShapeConfig, IdentifyModeConfig } from './modes/types';

const fret: ExerciseConfig = {
  exercise: 'root-notes',
  targetNote: 'A',
  durationSec: 300,
  continuous: false,
  maxFret: 12,
  showAllLabels: false,
  showRootMarkers: false,
  showFretNumbers: true,
  playSound: true,
  algorithm: 'fret-first',
  intervalKind: 'random',
  keyRoot: 'random',
  keyQuality: 'random',
  direction: 'nearest'
};

const shape: PlayShapeConfig = {
  exercise: 'play-shape',
  enabledModes: ['dorian', 'lydian'],
  shapeVariant: 'box',
  octaveJudge: 'pitch',
  boxSpan: 4,
  maxFret: 24,
  durationSec: 300,
  continuous: true,
  showFretNumbers: true,
  playSound: true,
  drone: false,
  highlightCharacteristic: false,
  fixedRootNote: null,
  inputMode: 'mic',
  micSensitivity: 0.5,
  micDeviceId: null,
  displayNotePercentage: 0
};

const identify: IdentifyModeConfig = {
  exercise: 'identify-mode',
  enabledModes: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian'],
  maxFret: 24,
  durationSec: 300,
  continuous: false,
  showFretNumbers: true,
  playSound: true,
  drone: false,
  highlightCharacteristic: false,
  fixedRootNote: null,
  promptMode: 'audio',
  displayNotePercentage: 0
};

describe('summarize', () => {
  it('root-notes', () => {
    expect(summarize(fret)).toBe('Root Notes · A · 5m · 12 frets');
  });

  it('random-roots', () => {
    const s = summarize({ ...fret, exercise: 'random-roots' });
    expect(s.startsWith('Root Notes')).toBe(true);
    expect(s).toContain('A/E/D');
  });

  it('intervals, all random', () => {
    expect(summarize({ ...fret, exercise: 'intervals', continuous: true, maxFret: 24 }))
      .toBe('Intervals · 3rd/5th · any key major/minor · Continuous · 24 frets');
  });

  it('intervals, fixed', () => {
    expect(summarize({
      ...fret, exercise: 'intervals', intervalKind: '5th', keyRoot: 'C#',
      keyQuality: 'minor', durationSec: 90, maxFret: 24
    })).toBe(`Intervals · 5th · ${NOTE_DISPLAY['C#']} minor · 90s · 24 frets`);
  });

  it('play-shape box + mic', () => {
    expect(summarize(shape))
      .toBe('Play the Shape · Dorian, Lydian · Box (4 frets) · Mic · Continuous · 24 frets');
  });

  it('play-shape all modes, octave, click', () => {
    const s = summarize({
      ...shape, enabledModes: [...MODE_ORDER], shapeVariant: 'octave',
      inputMode: 'click', continuous: false, durationSec: 600
    });
    expect(s).toContain('All modes · Octave · 10m');
    expect(s).not.toContain('Mic');
  });

  it('play-shape caged with pentatonics', () => {
    const s = summarize({ ...shape, enabledModes: ['minor-pentatonic', 'blues'], shapeVariant: 'caged' });
    expect(s).toContain('Minor pentatonic, Blues · CAGED · Mic');
    expect(summarize({ ...shape, enabledModes: ['ionian', 'dorian', 'blues', 'aeolian'] })).toContain('4 scales');
  });

  it('identify-mode by ear', () => {
    expect(summarize(identify)).toContain('5 modes · By ear');
  });
});

describe('summarize caged', () => {
  it('describes variant, shapes, qualities, root and input', () => {
    expect(summarize({
      exercise: 'caged', cagedVariant: 'find-tones', enabledShapes: ['E', 'C', 'A'],
      qualities: ['major', 'minor'], include7th: true, fixedRootNote: 'A', maxFret: 12,
      durationSec: 300, continuous: false, showFretNumbers: true, playSound: true,
      inputMode: 'mic', micSensitivity: 0.5, micDeviceId: null
    })).toBe('CAGED · Find tones · CAE · major/minor 7ths · in A · Mic · 5m · 12 frets');
  });
});
