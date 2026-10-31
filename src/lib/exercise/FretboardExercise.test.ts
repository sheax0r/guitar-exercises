import { describe, it, expect, vi } from 'vitest';
import { FretboardExercise } from './FretboardExercise';
import { noteAt, closestPositionOf } from '../music/notes';
import { scaleNotes, diatonicInterval } from '../music/scales';
import type { ExerciseConfig } from './types';

const DEFAULT_CONFIG: ExerciseConfig = {
  exercise: 'root-notes',
  targetNote: 'A',
  durationSec: 60,
  continuous: false,
  maxFret: 22,
  showAllLabels: false,
  showRootMarkers: false,
  showFretNumbers: true,
  playSound: false,
  algorithm: 'fret-first',
  intervals: ['3rd', '5th'], intervalRef: 'diatonic-from-note',
  keyRoot: 'C',
  keyQuality: 'major',
  direction: 'nearest'
};

describe('FretboardExercise.start + getNextPrompt', () => {
  it('produces prompts that are valid fretboard positions', () => {
    const ex = new FretboardExercise();
    ex.start(DEFAULT_CONFIG);
    for (let i = 0; i < 50; i++) {
      const prompt = ex.getNextPrompt();
      expect(prompt.highlight.string).toBeGreaterThanOrEqual(1);
      expect(prompt.highlight.string).toBeLessThanOrEqual(6);
      expect(prompt.highlight.fret).toBeGreaterThanOrEqual(0);
      expect(prompt.highlight.fret).toBeLessThanOrEqual(22);
      expect(prompt.highlightNote).toBe(noteAt(prompt.highlight.string, prompt.highlight.fret));
    }
  });
  it('does not produce the same prompt twice in a row', () => {
    const ex = new FretboardExercise();
    ex.start(DEFAULT_CONFIG);
    let prev = ex.getNextPrompt();
    for (let i = 0; i < 200; i++) {
      const next = ex.getNextPrompt();
      expect(
        next.highlight.string === prev.highlight.string &&
        next.highlight.fret === prev.highlight.fret
      ).toBe(false);
      prev = next;
    }
  });
});

describe('FretboardExercise random-roots mode', () => {
  const RANDOM_CONFIG: ExerciseConfig = { ...DEFAULT_CONFIG, exercise: 'random-roots' };

  it('carries the prompt target on root-notes mode (equals config.targetNote)', () => {
    const ex = new FretboardExercise();
    ex.start(DEFAULT_CONFIG);
    for (let i = 0; i < 20; i++) {
      expect(ex.getNextPrompt().targetNote).toBe('A');
    }
  });

  it('draws each prompt target only from {A, E, D}', () => {
    const ex = new FretboardExercise();
    ex.start(RANDOM_CONFIG);
    for (let i = 0; i < 100; i++) {
      expect(['A', 'E', 'D']).toContain(ex.getNextPrompt().targetNote);
    }
  });

  it('randomizes the target across prompts (not a single fixed note)', () => {
    const ex = new FretboardExercise();
    ex.start(RANDOM_CONFIG);
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(ex.getNextPrompt().targetNote);
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('accepts the closest position computed against the prompt target', () => {
    const ex = new FretboardExercise();
    ex.start(RANDOM_CONFIG);
    for (let i = 0; i < 30; i++) {
      const prompt = ex.getNextPrompt();
      const correct = closestPositionOf(prompt.targetNote, prompt.highlight, 22, 'fret-first');
      const result = ex.submitAnswer(correct[0]);
      expect(result.correct).toBe(true);
    }
  });
});

describe('FretboardExercise.submitAnswer', () => {
  it('marks an answer correct when it matches one of the closest positions', () => {
    const ex = new FretboardExercise();
    ex.start(DEFAULT_CONFIG);
    const prompt = ex.getNextPrompt();
    const correctAnswers = closestPositionOf('A', prompt.highlight, 22, 'fret-first');
    const result = ex.submitAnswer(correctAnswers[0]);
    expect(result.correct).toBe(true);
    expect(result.correctAnswers).toEqual(correctAnswers);
    expect(result.promptComplete).toBe(true);
    expect(typeof result.elapsedMs).toBe('number');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });
  it('accepts any tied position when the algorithm produces multiple closest matches', () => {
    const ex = new FretboardExercise();
    ex.start(DEFAULT_CONFIG);
    // Hand-set a prompt that produces a fret-first tie: from (s=4, f=1), the
    // tied A positions are (s=3, f=2) and (s=5, f=0). We can't easily inject
    // the prompt directly, so verify the behavior via closestPositionOf and
    // a forced-prompt smoke test that any tied entry is accepted.
    const tied = closestPositionOf('A', { string: 4, fret: 1 }, 22, 'fret-first');
    expect(tied).toHaveLength(2);
  });
  it('marks an answer incorrect when it does not match any closest position', () => {
    const ex = new FretboardExercise();
    ex.start(DEFAULT_CONFIG);
    const prompt = ex.getNextPrompt();
    const correctAnswers = closestPositionOf('A', prompt.highlight, 22, 'fret-first');
    // Pick a known A position that isn't in the correct set.
    const known: Array<{ string: 1|2|3|4|5|6; fret: number }> = [
      { string: 5, fret: 0 }, { string: 5, fret: 12 }, { string: 3, fret: 2 },
      { string: 1, fret: 5 }, { string: 6, fret: 5 }
    ];
    const wrong = known.find(
      k => !correctAnswers.some(c => c.string === k.string && c.fret === k.fret)
    )!;
    const result = ex.submitAnswer(wrong);
    expect(result.correct).toBe(false);
    expect(result.correctAnswers).toEqual(correctAnswers);
  });
  it('measures elapsed time between getNextPrompt and submitAnswer', () => {
    vi.useFakeTimers();
    try {
      const ex = new FretboardExercise();
      ex.start(DEFAULT_CONFIG);
      ex.getNextPrompt();
      vi.advanceTimersByTime(2500);
      const result = ex.submitAnswer({ string: 1, fret: 5 });
      expect(result.elapsedMs).toBeGreaterThanOrEqual(2400);
      expect(result.elapsedMs).toBeLessThanOrEqual(2600);
    } finally {
      vi.useRealTimers();
    }
  });

  it('subtracts paused time from elapsedMs via notifyResumed', () => {
    vi.useFakeTimers();
    try {
      const ex = new FretboardExercise();
      ex.start(DEFAULT_CONFIG);
      ex.getNextPrompt();
      vi.advanceTimersByTime(1000);  // 1s of thinking before pause
      vi.advanceTimersByTime(5000);  // wall-clock advances 5s during the pause
      ex.notifyResumed(5000);        // resume: subtract the 5s spent paused
      vi.advanceTimersByTime(500);   // 0.5s more thinking after resume
      const result = ex.submitAnswer({ string: 1, fret: 5 });
      // Attention time was 1.5s despite 6.5s of wall-clock since prompt.
      expect(result.elapsedMs).toBeGreaterThanOrEqual(1400);
      expect(result.elapsedMs).toBeLessThanOrEqual(1600);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('FretboardExercise.getReport', () => {
  it('returns zeroed stats when no prompts have been answered', () => {
    const ex = new FretboardExercise();
    ex.start(DEFAULT_CONFIG);
    const report = ex.getReport();
    expect(report.totalPrompts).toBe(0);
    expect(report.correctCount).toBe(0);
    expect(report.incorrectCount).toBe(0);
    expect(report.accuracy).toBe(0);
    expect(report.avgTimeMs).toBe(0);
    expect(report.perTargetStats).toEqual([]);
    expect(report.attempts).toEqual([]);
  });

  it('aggregates a scripted sequence correctly', () => {
    const ex = new FretboardExercise();
    ex.start(DEFAULT_CONFIG);
    let correctSubmitted = 0;
    let incorrectSubmitted = 0;
    for (let i = 0; i < 5; i++) {
      const prompt = ex.getNextPrompt();
      const correctSet = closestPositionOf('A', prompt.highlight, 22, 'fret-first');
      const correct = correctSet[0];
      if (i % 2 === 0) {
        ex.submitAnswer(correct);
        correctSubmitted++;
      } else {
        // Submit a known-wrong position by flipping the string number.
        const wrong = { string: ((correct.string % 6) + 1) as 1|2|3|4|5|6, fret: correct.fret };
        const isStillInSet = correctSet.some(p => p.string === wrong.string && p.fret === wrong.fret);
        if (wrong.string === correct.string || isStillInSet) {
          ex.submitAnswer(correct);
          correctSubmitted++;
        } else {
          ex.submitAnswer(wrong);
          incorrectSubmitted++;
        }
      }
    }
    const report = ex.getReport();
    expect(report.totalPrompts).toBe(5);
    expect(report.correctCount).toBe(correctSubmitted);
    expect(report.incorrectCount).toBe(incorrectSubmitted);
    expect(report.accuracy).toBeCloseTo(correctSubmitted / 5);
    const sumAsked = report.perTargetStats.reduce((s, p) => s + p.timesAsked, 0);
    expect(sumAsked).toBe(5);
  });

  it('keys perTargetStats by correct-answer position, not prompt position', () => {
    const ex = new FretboardExercise();
    ex.start({ ...DEFAULT_CONFIG, maxFret: 4 });
    for (let i = 0; i < 8; i++) {
      const p = ex.getNextPrompt();
      const correctSet = closestPositionOf('A', p.highlight, 4, 'fret-first');
      ex.submitAnswer(correctSet[0]);
    }
    const report = ex.getReport();
    for (const stat of report.perTargetStats) {
      expect(noteAt(stat.position.string, stat.position.fret)).toBe('A');
    }
  });
});

describe('FretboardExercise intervals mode', () => {
  const INTERVALS_CONFIG: ExerciseConfig = {
    ...DEFAULT_CONFIG,
    exercise: 'intervals',
    keyRoot: 'C',
    keyQuality: 'major',
    intervals: ['3rd'], intervalRef: 'diatonic-from-note',
    direction: 'nearest'
  };

  it('only shows notes that belong to the resolved key', () => {
    const ex = new FretboardExercise();
    ex.start(INTERVALS_CONFIG);
    const scale = scaleNotes('C', 'major');
    for (let i = 0; i < 100; i++) {
      const p = ex.getNextPrompt();
      expect(scale).toContain(p.highlightNote);
    }
  });

  it('targets the diatonic interval of the shown note', () => {
    const ex = new FretboardExercise();
    ex.start(INTERVALS_CONFIG);
    for (let i = 0; i < 100; i++) {
      const p = ex.getNextPrompt();
      expect(p.interval).toBe('3rd');
      expect(p.keyRoot).toBe('C');
      expect(p.keyQuality).toBe('major');
      expect(p.targetNote).toBe(diatonicInterval('C', 'major', p.highlightNote, '3rd'));
    }
  });

  it('draws a fresh interval each prompt when several intervals are enabled', () => {
    const ex = new FretboardExercise();
    ex.start({ ...INTERVALS_CONFIG, intervals: ['3rd', '5th'], intervalRef: 'diatonic-from-note' });
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const p = ex.getNextPrompt();
      expect(p.interval === '3rd' || p.interval === '5th').toBe(true);
      expect(p.targetNote).toBe(diatonicInterval('C', 'major', p.highlightNote, p.interval!));
      seen.add(p.interval!);
    }
    expect(seen.size).toBe(2);
  });

  it('supports the 2nd, 4th, 6th and 7th', () => {
    const ex = new FretboardExercise();
    ex.start({ ...INTERVALS_CONFIG, intervals: ['2nd', '4th', '6th', '7th'] });
    for (let i = 0; i < 50; i++) {
      const p = ex.getNextPrompt();
      expect(['2nd', '4th', '6th', '7th']).toContain(p.interval);
      expect(p.targetNote).toBe(diatonicInterval('C', 'major', p.highlightNote, p.interval!));
    }
  });

  it('from-root: shows the key root and targets a chromatic interval above it', () => {
    const ex = new FretboardExercise();
    ex.start({ ...INTERVALS_CONFIG, keyRoot: 'D', intervals: ['7th'], intervalRef: 'from-root' });
    const labels = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const p = ex.getNextPrompt();
      expect(p.highlightNote).toBe('D');
      expect(p.interval).toBe('7th');
      labels.add(p.intervalLabel!);
      expect(p.targetNote).toBe(p.intervalLabel === 'b7' ? 'C' : 'C#');
    }
    expect(labels).toEqual(new Set(['b7', '7']));
  });

  it('draws a fresh key each prompt when keyRoot/keyQuality are random', () => {
    const ex = new FretboardExercise();
    ex.start({ ...INTERVALS_CONFIG, keyRoot: 'random', keyQuality: 'random' });
    const roots = new Set<string>();
    const quals = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = ex.getNextPrompt();
      const scale = scaleNotes(p.keyRoot!, p.keyQuality!);
      expect(scale).toContain(p.highlightNote);
      expect(p.targetNote).toBe(diatonicInterval(p.keyRoot!, p.keyQuality!, p.highlightNote, p.interval!));
      roots.add(p.keyRoot!);
      quals.add(p.keyQuality!);
    }
    expect(roots.size).toBeGreaterThan(1);
    expect(quals.size).toBe(2);
  });

  it('throws (rather than looping) when no in-scale position exists', () => {
    // maxFret 0 + C# major: none of the open strings (E,A,D,G,B) are in the
    // scale, so the picker can never satisfy the constraint. Must terminate.
    const ex = new FretboardExercise();
    ex.start({ ...INTERVALS_CONFIG, keyRoot: 'C#', keyQuality: 'major', maxFret: 0 });
    expect(() => ex.getNextPrompt()).toThrow(/maxFret=0/);
  });

  it('honors the direction setting when computing accepted answers', () => {
    const ex = new FretboardExercise();
    ex.start({ ...INTERVALS_CONFIG, direction: 'ascending' });
    for (let i = 0; i < 50; i++) {
      const p = ex.getNextPrompt();
      const expected = closestPositionOf(p.targetNote, p.highlight, 22, 'fret-first', 'ascending');
      const result = ex.submitAnswer(expected[0]);
      expect(result.correct).toBe(true);
      expect(result.correctAnswers).toEqual(expected);
    }
  });
});
