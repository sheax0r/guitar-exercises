import { describe, it, expect } from 'vitest';
import { CagedExercise } from './CagedExercise';
import type { CagedConfig } from './types';
import { chordNotes, chordPositions, cagedInstances, nextShapeInstance } from '../../music/caged';
import { noteAt, pitchOf } from '../../music/notes';

const base: CagedConfig = {
  exercise: 'caged',
  cagedVariant: 'find-tones',
  enabledShapes: ['C', 'A', 'G', 'E', 'D'],
  qualities: ['major', 'minor'],
  include7th: false,
  fixedRootNote: null,
  maxFret: 24,
  durationSec: 300,
  continuous: true,
  showFretNumbers: true,
  playSound: false,
  inputMode: 'click',
  micJudge: 'notes',
  micSensitivity: 0.5,
  micDeviceId: null
};

function begin(over: Partial<CagedConfig> = {}) {
  const ex = new CagedExercise();
  ex.start({ ...base, ...over });
  return { ex, p: ex.getNextPrompt() };
}

describe('CagedExercise find-tones', () => {
  it('expects every chord tone in the window; completes in any order', () => {
    const { ex, p } = begin({ enabledShapes: ['E'], fixedRootNote: 'A', qualities: ['major'] });
    expect(p.shape).toBe('E');
    expect(p.anchor.string).toBe(6);
    const expected = chordPositions('A', 'maj', p.window);
    expect(p.expectedCount).toBe(expected.length);
    expect(p.shownPositions).toEqual([]);
    const order = [...expected].reverse();
    order.forEach((pos, i) => {
      const r = ex.submitAnswer(pos);
      expect(r.correct).toBe(true);
      expect(r.promptComplete).toBe(i === order.length - 1);
    });
    expect(ex.getReport()).toMatchObject({ totalPrompts: 1, correctCount: 1 });
  });

  it('a wrong or repeated click is wrong and marks the prompt missed', () => {
    const { ex, p } = begin({ enabledShapes: ['C'], fixedRootNote: 'C', qualities: ['major'], maxFret: 12 });
    const expected = chordPositions('C', 'maj', p.window);
    // C# (string 2 fret 2) is never a C-major tone.
    expect(ex.submitAnswer({ string: 2, fret: 2 }).correct).toBe(false);
    expect(ex.submitAnswer(expected[0]).correct).toBe(true);
    expect(ex.submitAnswer(expected[0]).correct).toBe(false);
    for (const pos of expected.slice(1)) ex.submitAnswer(pos);
    const r = ex.getReport();
    expect(r).toMatchObject({ totalPrompts: 1, correctCount: 0, incorrectCount: 1 });
    expect(r.perShapeStats).toEqual([expect.objectContaining({ shape: 'C', timesAsked: 1, correctCount: 0 })]);
  });

  it('mic: matches by pitch class inside the window, any order', () => {
    const { ex, p } = begin({ enabledShapes: ['E'], fixedRootNote: 'E', qualities: ['minor'], inputMode: 'mic', maxFret: 12 });
    const expected = chordPositions('E', 'min', p.window);
    // A note outside the chord is wrong.
    expect(ex.submitMicNote(pitchOf(1, 1)).correct).toBe(false); // F
    let last;
    for (const pos of expected) last = ex.submitMicNote(pitchOf(pos.string, pos.fret) + 12);
    expect(last!.promptComplete).toBe(true);
  });

  it('includes 7ths when asked', () => {
    const { p } = begin({ include7th: true, qualities: ['minor'] });
    expect(p.chord).toBe('m7');
  });
});

describe('CagedExercise name-shape', () => {
  it('shows the chord tones and needs both shape and root', () => {
    const { ex, p } = begin({ cagedVariant: 'name-shape' });
    const tones = new Set(chordNotes(p.rootNote, p.chord));
    expect(p.shownPositions.length).toBeGreaterThan(0);
    for (const s of p.shownPositions) expect(tones.has(noteAt(s.string, s.fret))).toBe(true);
    const wrongShape = p.shape === 'C' ? 'A' : 'C';
    const r = ex.submitAnswer({ shape: wrongShape, root: p.rootNote });
    expect(r).toMatchObject({ correct: false, promptComplete: true });
    expect(r.correctAnswers).toEqual([{ shape: p.shape, root: p.rootNote }]);

    const p2 = ex.getNextPrompt();
    expect(ex.submitAnswer({ shape: p2.shape, root: p2.rootNote }).correct).toBe(true);
    expect(ex.getReport()).toMatchObject({ totalPrompts: 2, correctCount: 1 });
  });
});

describe('CagedExercise next-shape', () => {
  it('asks for the roots of the next shape up the neck', () => {
    const { ex, p } = begin({ cagedVariant: 'next-shape', enabledShapes: ['E'], fixedRootNote: 'A' });
    expect(p.fromShape).toBe('E');
    expect(p.shape).toBe('D');
    const from = cagedInstances('E', 'A', 24).find(i => i.root.fret === p.anchor.fret)!;
    expect(p.shownPositions).toEqual(chordPositions('A', p.chord, from.window));
    const to = nextShapeInstance(from, 'A', 24)!;
    expect(p.window).toEqual(from.window);
    const roots = chordPositions('A', p.chord, to.window).filter(x => noteAt(x.string, x.fret) === 'A');
    expect(p.expectedCount).toBe(roots.length);
    // The current shape's own root is not the answer.
    expect(ex.submitAnswer(p.anchor).correct).toBe(false);
    let last;
    for (const r of roots) last = ex.submitAnswer(r);
    expect(last!.promptComplete).toBe(true);
    expect(ex.getReport().perShapeStats[0].shape).toBe('D');
  });
});

describe('CagedExercise prompt drawing', () => {
  it('throws instead of spinning when nothing fits', () => {
    const ex = new CagedExercise();
    ex.start({ ...base, enabledShapes: ['C'], fixedRootNote: 'A', maxFret: 5 });
    expect(() => ex.getNextPrompt()).toThrow();
  });

  it('repeats a prompt when the config allows only one', () => {
    const ex = new CagedExercise();
    ex.start({ ...base, enabledShapes: ['E'], fixedRootNote: 'A', qualities: ['major'], maxFret: 12 });
    ex.getNextPrompt();
    expect(ex.getNextPrompt().anchor).toEqual({ string: 6, fret: 5 });
  });

  it('avoids repeating the identical prompt back to back', () => {
    const ex = new CagedExercise();
    ex.start({ ...base, enabledShapes: ['E', 'A'], fixedRootNote: 'G', qualities: ['major'], maxFret: 12 });
    let prev = ex.getNextPrompt();
    for (let i = 0; i < 20; i++) {
      const p = ex.getNextPrompt();
      expect(`${p.shape}${p.anchor.fret}`).not.toBe(`${prev.shape}${prev.anchor.fret}`);
      prev = p;
    }
  });
});

describe('CagedExercise strum', () => {
  it('completes on the chord pitch-class set, lighting every tone', () => {
    const { ex, p } = begin({ enabledShapes: ['E'], fixedRootNote: 'A', qualities: ['major'] });
    const r = ex.submitStrum([45, 52, 57, 61, 64], false); // A E A C# E
    expect(r.correct).toBe(true);
    expect(r.promptComplete).toBe(true);
    expect(r.correctAnswers).toEqual(chordPositions('A', 'maj', p.window));
    expect(ex.getReport().correctCount).toBe(1);
  });

  it('a wrong strum keeps the prompt open and marks it wrong', () => {
    const { ex } = begin({ enabledShapes: ['E'], fixedRootNote: 'A', qualities: ['major'] });
    const bad = ex.submitStrum([45, 52, 57, 60, 64], false); // C natural
    expect(bad.correct).toBe(false);
    expect(bad.promptComplete).toBe(false);
    expect(bad.verdict.missing).toEqual([1]);
    expect(ex.submitStrum([45, 52, 57, 61, 64], false).promptComplete).toBe(true);
    expect(ex.getReport().incorrectCount).toBe(1);
  });

  it('requireBass checks the lowest note is the root', () => {
    const { ex } = begin({ enabledShapes: ['E'], fixedRootNote: 'A', qualities: ['major'] });
    expect(ex.submitStrum([52, 57, 61, 64], true).verdict.bassOk).toBe(false);
    expect(ex.submitStrum([45, 52, 57, 61, 64], true).correct).toBe(true);
  });
});
