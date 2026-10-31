import { describe, it, expect } from 'vitest';
import { encodeLick, decodeLick, fitGuitar, placeLick, MAX_LICK_NOTES } from './lick';
import { LickDrillExercise } from './LickDrillExercise';
import type { LickDrillConfig } from './types';
import { pitchOf } from '../../music/notes';

// A minor pentatonic lick at the 5th fret: A3 C4 D4 E4.
const LICK = [57, 60, 62, 64];

const base: LickDrillConfig = {
  exercise: 'lick-drill',
  lick: LICK,
  lickName: 'Penta',
  target: 'D',
  startString: 6,
  inputMode: 'click',
  micSensitivity: 0.5,
  micDeviceId: null,
  maxFret: 24,
  durationSec: 300,
  continuous: false,
  showFretNumbers: true,
  playSound: true
};

describe('lick encoding', () => {
  it('round-trips one URL-safe char per note', () => {
    const s = encodeLick([40, 57, 64, 88, 91, 28]);
    expect(s).toMatch(/^[A-Za-z0-9_-]{6}$/);
    expect(decodeLick(s)).toEqual([40, 57, 64, 88, 91, 28]);
  });

  it('rejects empty, too long or garbage input', () => {
    expect(decodeLick('')).toBeNull();
    expect(decodeLick(null)).toBeNull();
    expect(decodeLick('a!b')).toBeNull();
    expect(decodeLick('A'.repeat(MAX_LICK_NOTES + 1))).toBeNull();
    expect(decodeLick('A'.repeat(MAX_LICK_NOTES))).toHaveLength(MAX_LICK_NOTES);
  });
});

describe('fitGuitar', () => {
  it('moves a whistled lick down by octaves into guitar range', () => {
    expect(fitGuitar([86, 91, 93])).toEqual([74, 79, 81]);
  });
  it('moves a low line up', () => {
    expect(fitGuitar([36, 38])).toEqual([48, 50]);
  });
  it('leaves an in-range lick alone', () => {
    expect(fitGuitar(LICK)).toEqual(LICK);
  });
});

describe('placeLick', () => {
  it('starts on the asked string, other notes nearest that fret', () => {
    const p = placeLick(LICK, 6, 24)!;
    expect(p.pos[0]).toEqual({ string: 6, fret: 17 });  // A3 on the low E is fret 17
    expect(p.notes).toEqual(LICK);
    p.pos.forEach((q, i) => expect(pitchOf(q.string, q.fret)).toBe(p.notes[i]));
  });

  it('drops an octave when that keeps the start string on the neck', () => {
    const p = placeLick(LICK, 6, 12)!;
    expect(p.pos[0]).toEqual({ string: 6, fret: 5 });
    expect(p.notes).toEqual(LICK.map(m => m - 12));
    p.pos.forEach((q, i) => expect(pitchOf(q.string, q.fret)).toBe(p.notes[i]));
    expect(Math.max(...p.pos.map(q => q.fret))).toBeLessThanOrEqual(12);
  });

  it('with no start string, uses the lowest-fret position', () => {
    const p = placeLick([45, 48, 50], null, 12)!;
    expect(p.pos[0]).toEqual({ string: 5, fret: 0 });
  });

  it('returns null when it cannot fit', () => {
    expect(placeLick([40, 88], 1, 12)).toBeNull();
  });
});

describe('LickDrillExercise', () => {
  it('transposes to the asked start note by the nearest shift, from the asked string', () => {
    const ex = new LickDrillExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    expect(p.keyRoot).toBe('D');
    expect(p.shift).toBe(5);                       // A -> D is up a 4th
    expect(p.startString).toBe(6);
    expect(p.answer[0].string).toBe(6);
    expect(p.notes.map(n => n.note)).toEqual(['D', 'F', 'G', 'A']);
    expect(p.call.map(q => pitchOf(q.string, q.fret))).toEqual(LICK);
  });

  it('random target never keeps the original key', () => {
    const ex = new LickDrillExercise();
    ex.start({ ...base, target: 'random', startString: 'random' });
    for (let i = 0; i < 40; i++) {
      const p = ex.getNextPrompt();
      expect(p.keyRoot).not.toBe('A');
      expect(p.answer[0].string).toBe(p.startString);
      ex.skip();
    }
  });

  it('judges in order by pitch class; clicks must start on the asked string', () => {
    const ex = new LickDrillExercise();
    ex.start(base);
    ex.getNextPrompt();
    // D on the 5th string (fret 5): right note, wrong string.
    expect(ex.submitNote(50, undefined, 5)).toMatchObject({ noteCorrect: false, done: true, correct: false });

    const p = ex.getNextPrompt();
    expect(ex.submitNote(p.notes[0].midi, undefined, 6).noteCorrect).toBe(true);
    expect(ex.submitNote(p.notes[1].midi + 12, undefined, 2).noteCorrect).toBe(true); // any octave
    expect(ex.submitNote(p.notes[2].midi).done).toBe(false);
    expect(ex.submitNote(p.notes[3].midi)).toMatchObject({ done: true, correct: true, matched: 4 });
  });

  it('mic (no string) only checks pitch', () => {
    const ex = new LickDrillExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    expect(ex.submitNote(p.notes[0].midi + 12).noteCorrect).toBe(true);
  });

  it('reports per transposition and per note index, up to the first miss', () => {
    const ex = new LickDrillExercise();
    ex.start(base);
    let p = ex.getNextPrompt();
    for (const n of p.notes) ex.submitNote(n.midi);
    p = ex.getNextPrompt();
    ex.submitNote(p.notes[0].midi);
    ex.submitNote(p.notes[1].midi + 1);            // miss on note 2
    const r = ex.getReport();
    expect(r.totalPrompts).toBe(2);
    expect(r.correctCount).toBe(1);
    expect(r.perShiftStats).toEqual([expect.objectContaining({ shift: 5, keyRoot: 'D', timesAsked: 2, correctCount: 1 })]);
    expect(r.perIndexStats.map(s => [s.index, s.timesAsked, s.correctCount])).toEqual([[1, 2, 2], [2, 2, 1], [3, 1, 1], [4, 1, 1]]);
  });
});
