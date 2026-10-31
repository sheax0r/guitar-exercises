import { describe, it, expect, vi, afterEach } from 'vitest';
import { CallResponseExercise } from './CallResponseExercise';
import type { CallResponseConfig } from './types';
import { CHROMATIC } from '../../music/notes';

const base: CallResponseConfig = {
  exercise: 'call-response',
  lengths: [3],
  degrees: ['1', '3', '5'],
  motion: 'leaps',
  showStart: false,
  rhythm: false,
  keyRoot: 'C',
  drone: false,
  inputMode: 'mic',
  micSensitivity: 0.5,
  micDeviceId: null,
  maxFret: 12,
  durationSec: 60,
  continuous: false,
  showFretNumbers: true,
  playSound: true
};

function make(over: Partial<CallResponseConfig> = {}) {
  const ex = new CallResponseExercise();
  ex.start({ ...base, ...over });
  return ex;
}

afterEach(() => vi.restoreAllMocks());

describe('CallResponseExercise — phrases', () => {
  it('draws phrases of the allowed lengths from the allowed degrees, never repeating a note', () => {
    const ex = make({ lengths: [2, 4], degrees: ['1', '2', '5'] });
    for (let i = 0; i < 200; i++) {
      const p = ex.getNextPrompt();
      expect([2, 4]).toContain(p.notes.length);
      for (const n of p.notes) {
        expect(['1', '2', '5']).toContain(n.degree);
        expect(n.midi).toBeGreaterThanOrEqual(52);
        expect(n.midi).toBeLessThanOrEqual(75);
        expect(CHROMATIC[n.midi % 12]).toBe(n.note);
      }
      for (let k = 1; k < p.notes.length; k++) expect(p.notes[k].midi).not.toBe(p.notes[k - 1].midi);
      ex.skip();
    }
  });

  it('stepwise moves only to a neighbouring pool note', () => {
    // Pool in C with 1-3-5: C4(60) E4(64) G4(67) C5(72) — root register 52..63 puts C at 60.
    const pool = [60, 64, 67, 72];
    const ex = make({ motion: 'stepwise', lengths: [4] });
    for (let i = 0; i < 200; i++) {
      const p = ex.getNextPrompt();
      for (let k = 1; k < p.notes.length; k++) {
        expect(Math.abs(pool.indexOf(p.notes[k].midi) - pool.indexOf(p.notes[k - 1].midi))).toBe(1);
      }
      ex.skip();
    }
  });

  it('uses even quarters without rhythm, eighths or quarters with it', () => {
    const plain = make().getNextPrompt();
    expect(plain.notes.every(n => n.sixteenths === 4)).toBe(true);
    const ex = make({ rhythm: true });
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) { ex.getNextPrompt().notes.forEach(n => seen.add(n.sixteenths)); ex.skip(); }
    expect([...seen].sort()).toEqual([2, 4]);
  });
});

describe('CallResponseExercise — judging', () => {
  it('accepts the phrase in order at any octave', () => {
    const ex = make();
    const p = ex.getNextPrompt();
    const r1 = ex.submitNote(p.notes[0].midi + 12);
    expect(r1).toMatchObject({ noteCorrect: true, done: false, matched: 1 });
    ex.submitNote(p.notes[1].midi - 12);
    const r3 = ex.submitNote(p.notes[2].midi);
    expect(r3).toMatchObject({ noteCorrect: true, done: true, correct: true });
    expect(ex.getReport().correctCount).toBe(1);
  });

  it('ends the phrase on the first wrong note', () => {
    const ex = make();
    const p = ex.getNextPrompt();
    ex.submitNote(p.notes[0].midi);
    const r = ex.submitNote(p.notes[1].midi + 1);
    expect(r).toMatchObject({ noteCorrect: false, done: true, correct: false });
    const rep = ex.getReport();
    expect(rep.incorrectCount).toBe(1);
    // The third note wasn't attempted, so only two degrees are counted.
    expect(rep.perDegreeStats.reduce((n, s) => n + s.timesAsked, 0)).toBe(2);
  });

  it('judges rhythm by quantized onset gaps when asked', () => {
    const ex = make({ rhythm: true, lengths: [3] });
    const p = ex.getNextPrompt();
    const sec16 = 60 / 90 / 4;
    let t = 1;
    const times = p.notes.map(n => { const at = t; t += n.sixteenths * sec16; return at; });
    // On time (with a constant latency shift) is right.
    p.notes.forEach((n, i) => ex.submitNote(n.midi, times[i] + 0.12));
    expect(ex.getReport().correctCount).toBe(1);
    // Rushed: 50ms gaps round to a single sixteenth -> wrong rhythm.
    const p2 = ex.getNextPrompt();
    let r;
    p2.notes.forEach((n, i) => { r = ex.submitNote(n.midi, 1 + i * 0.05); });
    expect(r).toMatchObject({ done: true, correct: false, rhythmOff: true });
  });

  it('ignores rhythm when no times are given (clicks)', () => {
    const ex = make({ rhythm: true });
    const p = ex.getNextPrompt();
    let r;
    for (const n of p.notes) r = ex.submitNote(n.midi);
    expect(r).toMatchObject({ correct: true, rhythmOff: false });
  });

  it('skip counts a miss', () => {
    const ex = make();
    ex.getNextPrompt();
    ex.skip();
    expect(ex.getReport()).toMatchObject({ totalPrompts: 1, incorrectCount: 1 });
  });

  it('reports per length and per degree in order', () => {
    const ex = make({ lengths: [2, 3] });
    for (let i = 0; i < 20; i++) {
      const p = ex.getNextPrompt();
      for (const n of p.notes) ex.submitNote(n.midi);
    }
    const r = ex.getReport();
    expect(r.perLengthStats.map(s => s.length)).toEqual([2, 3]);
    expect(r.perDegreeStats.map(s => s.degree)).toEqual(['1', '3', '5']);
    expect(r.accuracy).toBe(1);
  });
});
