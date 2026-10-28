import { describe, it, expect } from 'vitest';
import { IdentifyModeExercise } from './IdentifyModeExercise';
import type { IdentifyModeConfig } from './types';
import { scaleNotes } from '../../music/modes';
import { noteAt } from '../../music/notes';
import { octaveFixedPositions } from './shape';

const cfg: IdentifyModeConfig = {
  exercise: 'identify-mode',
  enabledModes: ['ionian', 'dorian'],
  maxFret: 24,
  durationSec: 300,
  continuous: true,
  showFretNumbers: true,
  playSound: false,
  drone: false,
  highlightCharacteristic: false,
  fixedRootNote: null,
  promptMode: 'visual',
  displayNotePercentage: 100
};

describe('IdentifyModeExercise', () => {
  it('correct when the chosen mode matches, completes immediately', () => {
    const ex = new IdentifyModeExercise();
    ex.start(cfg);
    const p = ex.getNextPrompt();
    const r = ex.submitAnswer({ mode: p.mode });
    expect(r.correct).toBe(true);
    expect(r.promptComplete).toBe(true);
  });

  it('wrong when mismatched; report aggregates per mode', () => {
    const ex = new IdentifyModeExercise();
    ex.start(cfg);
    const p = ex.getNextPrompt();
    const wrong = p.mode === 'ionian' ? 'dorian' : 'ionian';
    const r = ex.submitAnswer({ mode: wrong });
    expect(r.correct).toBe(false);
    expect(r.correctAnswers).toEqual([{ mode: p.mode }]);
    const rep = ex.getReport();
    expect(rep.totalPrompts).toBe(1);
    expect(rep.perModeStats.find(s => s.mode === p.mode)!.timesAsked).toBe(1);
  });

  it('prompt highlights all scale-note positions with the roots flagged', () => {
    const ex = new IdentifyModeExercise();
    ex.start(cfg);
    const p = ex.getNextPrompt();
    expect(p.positions.length).toBeGreaterThan(0);
    const classes = new Set(scaleNotes(p.rootNote, p.mode));
    for (const pos of p.positions) {
      expect(classes.has(noteAt(pos.string, pos.fret))).toBe(true);
    }
    // Root positions are a non-empty subset whose note is the root note.
    expect(p.rootPositions.length).toBeGreaterThan(0);
    for (const pos of p.rootPositions) {
      expect(noteAt(pos.string, pos.fret)).toBe(p.rootNote);
    }
  });

  it('visiblePositions is a subset of positions sized by displayNotePercentage', () => {
    const ex = new IdentifyModeExercise();
    ex.start({ ...cfg, displayNotePercentage: 50 });
    const p = ex.getNextPrompt();
    const keys = new Set(p.positions.map(x => `${x.string}-${x.fret}`));
    expect(p.visiblePositions.length).toBe(Math.round(p.positions.length * 0.5));
    for (const v of p.visiblePositions) expect(keys.has(`${v.string}-${v.fret}`)).toBe(true);
  });

  it('shows the full scale at 100% and nothing at 0%', () => {
    const ex = new IdentifyModeExercise();
    ex.start({ ...cfg, displayNotePercentage: 100 });
    const full = ex.getNextPrompt();
    expect(full.visiblePositions.length).toBe(full.positions.length);
    ex.start({ ...cfg, displayNotePercentage: 0 });
    expect(ex.getNextPrompt().visiblePositions).toHaveLength(0);
  });

  it('fixed root: every prompt uses the configured root note', () => {
    const ex = new IdentifyModeExercise();
    ex.start({ ...cfg, enabledModes: ['ionian', 'dorian', 'phrygian'], fixedRootNote: 'D' });
    for (let i = 0; i < 30; i++) {
      expect(ex.getNextPrompt().rootNote).toBe('D');
    }
  });

  it('audio prompt only draws roots whose one-octave shape is reachable', () => {
    const ex = new IdentifyModeExercise();
    ex.start({
      ...cfg,
      enabledModes: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
      maxFret: 12,
      promptMode: 'audio'
    });
    for (let i = 0; i < 60; i++) {
      const p = ex.getNextPrompt();
      expect(octaveFixedPositions(p.root, p.mode, 12)).not.toBeNull();
    }
  });

  it('fixed root with no position within maxFret falls back to random (no lie, no crash)', () => {
    const ex = new IdentifyModeExercise();
    // C# has no position at fret 0–1 on any string.
    ex.start({ ...cfg, maxFret: 1, fixedRootNote: 'C#' });
    const roots = new Set<string>();
    for (let i = 0; i < 20; i++) roots.add(ex.getNextPrompt().rootNote);
    expect(roots.has('C#')).toBe(false); // never claims the unreachable root
  });
});
