import { describe, it, expect } from 'vitest';
import { IdentifyModeExercise } from './IdentifyModeExercise';
import type { IdentifyModeConfig } from './types';
import { scaleNotes } from '../../music/modes';
import { noteAt } from '../../music/notes';

const cfg: IdentifyModeConfig = {
  exercise: 'identify-mode',
  enabledModes: ['ionian', 'dorian'],
  maxFret: 24,
  durationSec: 300,
  continuous: true,
  showFretNumbers: true,
  playSound: false
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
});
