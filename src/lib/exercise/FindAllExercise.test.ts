import { describe, it, expect } from 'vitest';
import { FindAllExercise, FIND_ALL_SPAN } from './FindAllExercise';
import type { ExerciseConfig } from './types';
import { allPositionsOf } from '../music/notes';

const base: ExerciseConfig = {
  exercise: 'root-notes',
  targetNote: 'A',
  durationSec: 300,
  continuous: true,
  maxFret: 12,
  showAllLabels: false,
  showRootMarkers: false,
  showFretNumbers: true,
  playSound: false,
  algorithm: 'fret-first',
  intervals: ['3rd', '5th'],
  intervalRef: 'diatonic-from-note',
  keyRoot: 'C',
  keyQuality: 'major',
  direction: 'nearest',
  rootVariant: 'find-all',
  findAllWindow: 'neck'
};

describe('FindAllExercise', () => {
  it('whole neck: completes when every occurrence is clicked, any order', () => {
    const ex = new FindAllExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const all = allPositionsOf('A', 12).reverse();
    expect(p.window).toEqual([0, 12]);
    expect(p.expectedCount).toBe(all.length);
    all.forEach((pos, i) => {
      const r = ex.submitAnswer(pos);
      expect(r.correct).toBe(true);
      expect(r.promptComplete).toBe(i === all.length - 1);
    });
    const rep = ex.getReport();
    expect(rep.correctCount).toBe(1);
    expect(rep.perTargetStats).toHaveLength(all.length);
  });

  it('a wrong or repeated click is wrong and marks the prompt incorrect', () => {
    const ex = new FindAllExercise();
    ex.start(base);
    ex.getNextPrompt();
    const all = allPositionsOf('A', 12);
    expect(ex.submitAnswer({ string: 1, fret: 0 }).correct).toBe(false); // E
    expect(ex.submitAnswer(all[0]).correct).toBe(true);
    expect(ex.submitAnswer(all[0]).correct).toBe(false);
    for (const pos of all.slice(1)) ex.submitAnswer(pos);
    expect(ex.getReport()).toMatchObject({ totalPrompts: 1, correctCount: 0, incorrectCount: 1 });
  });

  it('reveal gives up: returns the missed positions and records the prompt incorrect', () => {
    const ex = new FindAllExercise();
    ex.start(base);
    ex.getNextPrompt();
    const all = allPositionsOf('A', 12);
    ex.submitAnswer(all[0]);
    const r = ex.reveal();
    expect(r.promptComplete).toBe(true);
    expect(r.correctAnswers).toHaveLength(all.length - 1);
    expect(ex.getReport()).toMatchObject({ totalPrompts: 1, correctCount: 0 });
  });

  it('window: only occurrences inside a 5-fret window, within maxFret', () => {
    const ex = new FindAllExercise();
    ex.start({ ...base, exercise: 'random-roots', findAllWindow: 'window' });
    for (let i = 0; i < 50; i++) {
      const p = ex.getNextPrompt();
      expect(['A', 'E', 'D']).toContain(p.targetNote);
      expect(p.window[1] - p.window[0]).toBe(FIND_ALL_SPAN - 1);
      expect(p.window[0]).toBeGreaterThanOrEqual(0);
      expect(p.window[1]).toBeLessThanOrEqual(12);
      const inWin = allPositionsOf(p.targetNote, 12).filter(x => x.fret >= p.window[0] && x.fret <= p.window[1]);
      expect(p.expectedCount).toBe(inWin.length);
      for (const pos of inWin) ex.submitAnswer(pos);
    }
    expect(ex.getReport().correctCount).toBe(50);
  });
});
