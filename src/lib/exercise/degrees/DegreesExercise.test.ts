import { describe, it, expect } from 'vitest';
import { DegreesExercise } from './DegreesExercise';
import type { DegreesConfig } from './types';
import { noteAt, closestPositionOf } from '../../music/notes';
import { degreeOf, transpose, DEGREE_LABELS } from '../../music/scales';

const base: DegreesConfig = {
  exercise: 'degrees',
  degreeVariant: 'name',
  keyRoot: 'D',
  algorithm: 'fret-first',
  maxFret: 12,
  durationSec: 300,
  continuous: true,
  showFretNumbers: true,
  playSound: false
};

describe('DegreesExercise — name (forward)', () => {
  it('the answer is the highlighted note\'s degree in the key', () => {
    const ex = new DegreesExercise();
    ex.start(base);
    for (let i = 0; i < 50; i++) {
      const p = ex.getNextPrompt();
      expect(p.keyRoot).toBe('D');
      expect(p.degree).toBe(degreeOf('D', noteAt(p.highlight.string, p.highlight.fret)));
      const wrong = DEGREE_LABELS.find(d => d !== p.degree)!;
      const r = ex.submitAnswer(i % 2 ? { degree: p.degree } : { degree: wrong });
      expect(r.correct).toBe(i % 2 === 1);
      expect(r.promptComplete).toBe(true);
    }
    const rep = ex.getReport();
    expect(rep.totalPrompts).toBe(50);
    expect(rep.correctCount).toBe(25);
    expect(rep.perDegreeStats.reduce((n, s) => n + s.timesAsked, 0)).toBe(50);
  });
});

describe('DegreesExercise — find (reverse)', () => {
  it('accepts the nearest occurrence of the degree from the start position', () => {
    const ex = new DegreesExercise();
    ex.start({ ...base, degreeVariant: 'find', keyRoot: 'random' });
    for (let i = 0; i < 50; i++) {
      const p = ex.getNextPrompt();
      expect(p.targetNote).toBe(transpose(p.keyRoot, DEGREE_LABELS.indexOf(p.degree)));
      expect(noteAt(p.highlight.string, p.highlight.fret)).not.toBe(p.targetNote);
      const nearest = closestPositionOf(p.targetNote, p.highlight, 12, 'fret-first', 'nearest');
      const r = ex.submitAnswer(nearest[0]);
      expect(r.correct).toBe(true);
    }
  });

  it('a far occurrence is wrong and reports the nearest', () => {
    const ex = new DegreesExercise();
    ex.start({ ...base, degreeVariant: 'find' });
    const p = ex.getNextPrompt();
    const r = ex.submitAnswer({ string: p.highlight.string, fret: p.highlight.fret });
    expect(r.correct).toBe(false);
    expect(r.correctAnswers.length).toBeGreaterThan(0);
  });
});
