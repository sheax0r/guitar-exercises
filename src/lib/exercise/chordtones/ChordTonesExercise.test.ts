import { describe, it, expect, vi, afterEach } from 'vitest';
import { ChordTonesExercise } from './ChordTonesExercise';
import type { ChordTonesConfig } from './types';
import { progressionChords } from '../../music/progressions';
import { noteAt, pitchOf, allPositionsOf } from '../../music/notes';

const base: ChordTonesConfig = {
  exercise: 'chord-tones',
  progression: 'ii-V-I',
  keyRoot: 'C',
  target: 'guide',
  backing: 'chord',
  tempo: 'untimed',
  bpm: 80,
  barsPerChord: 1,
  algorithm: 'fret-first',
  inputMode: 'click',
  micSensitivity: 0.5,
  micDeviceId: null,
  maxFret: 12,
  durationSec: 60,
  continuous: false,
  showFretNumbers: true,
  playSound: true
};

function make(over: Partial<ChordTonesConfig> = {}) {
  const ex = new ChordTonesExercise();
  ex.start({ ...base, ...over });
  return ex;
}

// Clicks the first accepted answer of the current prompt.
function answerRight(ex: ChordTonesExercise) {
  return ex.submitAnswer(ex.expected()[0]);
}

afterEach(() => vi.restoreAllMocks());

describe('progressionChords', () => {
  it('merges the blues repeats into multi-bar chords', () => {
    const chords = progressionChords('blues');
    expect(chords.map(c => `${c.numeral}x${c.bars}`)).toEqual(['I7x4', 'IV7x2', 'I7x2', 'V7x1', 'IV7x1', 'I7x1', 'V7x1']);
    expect(chords.reduce((n, c) => n + c.bars, 0)).toBe(12);
  });

  it('builds 7th chords on the right degrees', () => {
    expect(progressionChords('I-vi-IV-V').map(c => [c.numeral, c.semis, c.type]))
      .toEqual([['I', 0, 'maj7'], ['vi', 9, 'm7'], ['IV', 5, 'maj7'], ['V', 7, '7']]);
  });
});

describe('ChordTonesExercise', () => {
  it('walks the ii-V-I guide-tone line in C', () => {
    const ex = make();
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const p = ex.getNextPrompt();
      seen.push(`${p.numeral}:${p.tone}:${p.targetNotes.join('')}`);
      answerRight(ex);
    }
    expect(seen).toEqual(['ii:3rd:F', 'V:7th:F', 'I:3rd:E', 'ii:7th:C', 'V:3rd:B', 'I:7th:B']);
  });

  it('accepts only the occurrence nearest the previous answer', () => {
    const ex = make({ target: '3rd' });
    expect(ex.getNextPrompt().targetNotes).toEqual(['F']);
    const first = ex.expected()[0];
    ex.submitAnswer(first);
    const p2 = ex.getNextPrompt();
    expect(p2.from).toEqual(first);
    const exp = ex.expected();
    for (const e of exp) expect(noteAt(e.string, e.fret)).toBe('B');
    const far = allPositionsOf('B', 12).find(b => !exp.some(e => e.string === b.string && e.fret === b.fret))!;
    expect(ex.submitAnswer(far).correct).toBe(false);
  });

  it('chains from the expected position after a wrong answer', () => {
    const ex = make({ target: '3rd' });
    ex.getNextPrompt();
    const expected = ex.expected()[0];
    const wrong = { string: 1 as const, fret: 0 }; // E is never Dm7's 3rd
    expect(ex.submitAnswer(wrong).correct).toBe(false);
    expect(ex.getNextPrompt().from).toEqual(expected);
  });

  it("'any' excludes the previous answer's pitch class", () => {
    const ex = make({ target: 'any', progression: 'I-IV-V' });
    ex.getNextPrompt();
    const first = ex.expected()[0];
    ex.submitAnswer(first);
    const p = ex.getNextPrompt();
    expect(p.targetNotes).not.toContain(noteAt(first.string, first.fret));
    expect(p.targetNotes.length).toBeGreaterThanOrEqual(3);
  });

  it('counts an unanswered change as a miss (timed mode)', () => {
    const ex = make({ tempo: 'timed' });
    ex.getNextPrompt();
    ex.getNextPrompt(); // the first chord went by unanswered
    answerRight(ex);
    const r = ex.getReport();
    expect(r.totalPrompts).toBe(2);
    expect(r.correctCount).toBe(1);
    expect(r.perChordStats.find(s => s.numeral === 'ii')).toMatchObject({ timesAsked: 1, correctCount: 0 });
  });

  it('reports per chord and per tone type', () => {
    const ex = make();
    for (let i = 0; i < 3; i++) {
      ex.getNextPrompt();
      if (i === 1) ex.submitAnswer({ string: 1, fret: 0 }); else answerRight(ex);
    }
    const r = ex.getReport();
    expect(r.perChordStats.map(s => s.numeral)).toEqual(['ii', 'V', 'I']);
    expect(r.perToneStats).toEqual([
      expect.objectContaining({ tone: '3rd', timesAsked: 2, correctCount: 2 }),
      expect.objectContaining({ tone: '7th', timesAsked: 1, correctCount: 0 })
    ]);
  });

  it('redraws a random key each loop', () => {
    const rnd = vi.spyOn(Math, 'random');
    const ex = make({ keyRoot: 'random', progression: 'I-IV-V' });
    rnd.mockReturnValue(0); // key C, start position
    expect(ex.getNextPrompt().keyRoot).toBe('C');
    answerRight(ex); ex.getNextPrompt(); answerRight(ex); ex.getNextPrompt(); answerRight(ex);
    rnd.mockReturnValue(0.99); // B
    expect(ex.getNextPrompt().keyRoot).toBe('B');
  });

  it('upcoming() previews the next chord, including a random key across the loop', () => {
    const ex = make({ keyRoot: 'random', progression: 'I-IV-V' });
    for (let i = 0; i < 7; i++) {
      const up = ex.upcoming();
      const p = ex.getNextPrompt();
      expect([p.numeral, p.chordRoot, p.chordType, p.bars]).toEqual([up.numeral, up.chordRoot, up.chordType, up.bars]);
      answerRight(ex);
    }
  });

  describe('mic', () => {
    it('accepts the target pitch played near the expected position', () => {
      const ex = make({ target: '3rd' });
      ex.getNextPrompt();
      const e = ex.expected()[0];
      expect(ex.submitMicNote(pitchOf(e.string, e.fret)).correct).toBe(true);
    });

    it('rejects a wrong pitch class', () => {
      const ex = make({ target: '3rd' });
      ex.getNextPrompt();
      const e = ex.expected()[0];
      expect(ex.submitMicNote(pitchOf(e.string, e.fret) + 1).correct).toBe(false);
    });

    it('rejects the right note in a far-away position', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // start at string 1 fret 0, so Dm7's 3rd is F at 1/1
      const ex = make({ target: '3rd', maxFret: 22 });
      ex.getNextPrompt();
      expect(ex.expected()).toEqual([{ string: 1, fret: 1 }]);
      // F an octave up is only playable at frets 13 and above.
      expect(ex.submitMicNote(pitchOf(1, 13)).correct).toBe(false);
    });

    it('chains from where the note was heard', () => {
      const ex = make({ target: '3rd' });
      ex.getNextPrompt();
      const e = ex.expected()[0];
      ex.submitMicNote(pitchOf(e.string, e.fret));
      const from = ex.getNextPrompt().from;
      expect(pitchOf(from.string, from.fret)).toBe(pitchOf(e.string, e.fret));
    });
  });

  it('takes one answer per chord', () => {
    const ex = make();
    ex.getNextPrompt();
    answerRight(ex);
    expect(ex.isAnswered()).toBe(true);
    expect(() => answerRight(ex)).toThrow();
  });
});
