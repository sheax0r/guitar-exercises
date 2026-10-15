import { describe, it, expect } from 'vitest';
import { PlayShapeExercise } from './PlayShapeExercise';
import type { PlayShapeConfig } from './types';
import { octaveFixedPositions, boxPositions } from './shape';

const base: PlayShapeConfig = {
  exercise: 'play-shape',
  enabledModes: ['ionian'],
  shapeVariant: 'octave',
  octaveJudge: 'fixed',
  boxSpan: 4,
  maxFret: 24,
  durationSec: 300,
  continuous: true,
  showFretNumbers: true,
  playSound: false
};

describe('PlayShapeExercise octave/fixed', () => {
  it('accepts the canonical sequence and completes on the last click', () => {
    const ex = new PlayShapeExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    expect(p.expectedCount).toBe(seq.length);
    for (let i = 0; i < seq.length; i++) {
      const r = ex.submitAnswer(seq[i]);
      expect(r.correct).toBe(true);
      expect(r.promptComplete).toBe(i === seq.length - 1);
    }
  });

  it('a wrong click does not advance or complete the prompt', () => {
    const ex = new PlayShapeExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    ex.submitAnswer(seq[0]);
    const wrong = { string: seq[1].string, fret: (seq[1].fret + 1) % 25 };
    const r = ex.submitAnswer(wrong);
    expect(r.correct).toBe(false);
    expect(r.promptComplete).toBe(false);
    // The next expected step still accepts the right note.
    expect(ex.submitAnswer(seq[1]).correct).toBe(true);
  });

  it('report aggregates per mode and marks a clean run correct', () => {
    const ex = new PlayShapeExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    seq.forEach(s => ex.submitAnswer(s));
    const rep = ex.getReport();
    expect(rep.totalPrompts).toBe(1);
    expect(rep.correctCount).toBe(1);
    expect(rep.perModeStats.find(s => s.mode === p.mode)!.timesAsked).toBe(1);
  });

  it('a prompt with any wrong click is recorded incorrect', () => {
    const ex = new PlayShapeExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    const wrong = { string: seq[1].string, fret: (seq[1].fret + 1) % 25 };
    ex.submitAnswer(seq[0]);
    ex.submitAnswer(wrong);
    seq.slice(1).forEach(s => ex.submitAnswer(s));
    const rep = ex.getReport();
    expect(rep.totalPrompts).toBe(1);
    expect(rep.correctCount).toBe(0);
  });
});

describe('PlayShapeExercise octave reachability', () => {
  it('never emits a root whose octave cannot fit maxFret', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, maxFret: 5 });
    for (let i = 0; i < 50; i++) {
      const p = ex.getNextPrompt();
      const seq = octaveFixedPositions(p.root, p.mode, 5);
      expect(seq).not.toBeNull();
      seq!.forEach(s => ex.submitAnswer(s));
    }
  });
});

describe('PlayShapeExercise infeasible configs', () => {
  it('throws instead of hanging when the box span makes every shape empty', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, shapeVariant: 'box', boxSpan: 0 });
    expect(() => ex.getNextPrompt()).toThrow();
  });

  it('throws instead of hanging when no root can fit an octave (maxFret 1)', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, shapeVariant: 'octave', octaveJudge: 'fixed', maxFret: 1 });
    expect(() => ex.getNextPrompt()).toThrow();
  });
});

describe('PlayShapeExercise box', () => {
  it('completes only when every box position is clicked, any order', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, shapeVariant: 'box' });
    const p = ex.getNextPrompt();
    const set = boxPositions(p.root, p.mode, 24, 4);
    expect(p.expectedCount).toBe(set.length);
    for (let i = 0; i < set.length; i++) {
      const r = ex.submitAnswer(set[i]);
      expect(r.correct).toBe(true);
      expect(r.promptComplete).toBe(i === set.length - 1);
    }
  });

  it('clicking an already-clicked box position is wrong and does not complete', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, shapeVariant: 'box' });
    const p = ex.getNextPrompt();
    const set = boxPositions(p.root, p.mode, 24, 4);
    ex.submitAnswer(set[0]);
    const r = ex.submitAnswer(set[0]);
    expect(r.correct).toBe(false);
    expect(r.promptComplete).toBe(false);
  });
});
