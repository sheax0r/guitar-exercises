import type { Exercise, AnswerResult } from './Exercise';
import type { ExerciseConfig, ExerciseAnswer, ExerciseReport, PerTargetStat } from './types';
import { allPositionsOf, type Note } from '../music/notes';
import type { StringNum } from '../music/tuning';

type Pos = ExerciseAnswer;

// Root Notes "find all": click every occurrence of the target note inside a
// fret window (or the whole neck), in any order. Wrong clicks count against the
// prompt; it completes when every occurrence is found.
export const FIND_ALL_SPAN = 5; // frets in the 'window' variant

export interface FindAllPrompt {
  targetNote: Note;
  window: [number, number];   // inclusive fret range searched
  expectedCount: number;
}

const RANDOM_ROOT_NOTES: Note[] = ['A', 'E', 'D'];
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const key = (p: Pos) => `${p.string}-${p.fret}`;

export class FindAllExercise implements Exercise<ExerciseConfig, FindAllPrompt, Pos, ExerciseReport> {
  private config!: ExerciseConfig;
  private prompt: FindAllPrompt | null = null;
  private expected: Pos[] = [];
  private found = new Set<string>();
  private hadWrong = false;
  private startedAt = 0;
  private prevKey = '';
  // Per found position: how long it took to find and whether the prompt was clean.
  private finds: Array<{ pos: Pos; elapsedMs: number }> = [];
  private stats: Array<{ pos: Pos; correct: boolean; elapsedMs: number }> = [];
  private attempts: Array<{ correct: boolean; elapsedMs: number }> = [];

  start(config: ExerciseConfig): void {
    this.config = config;
    this.prompt = null;
    this.prevKey = '';
    this.stats = [];
    this.attempts = [];
  }

  getNextPrompt(): FindAllPrompt {
    const { maxFret } = this.config;
    for (let tries = 0; tries < 200; tries++) {
      const targetNote = this.config.exercise === 'random-roots' ? pick(RANDOM_ROOT_NOTES) : this.config.targetNote;
      let window: [number, number] = [0, maxFret];
      if (this.config.findAllWindow === 'window' && maxFret + 1 > FIND_ALL_SPAN) {
        const lo = Math.floor(Math.random() * (maxFret - FIND_ALL_SPAN + 2));
        window = [lo, lo + FIND_ALL_SPAN - 1];
      }
      const expected = allPositionsOf(targetNote, maxFret).filter(p => p.fret >= window[0] && p.fret <= window[1]);
      const k = `${targetNote}${window[0]}`;
      // Whole neck with a fixed note repeats by design; only windows re-roll.
      if (expected.length === 0 || (k === this.prevKey && window[1] - window[0] < maxFret && tries < 100)) continue;
      this.prevKey = k;
      this.expected = expected;
      this.found = new Set();
      this.finds = [];
      this.hadWrong = false;
      this.prompt = { targetNote, window, expectedCount: expected.length };
      this.startedAt = Date.now();
      return this.prompt;
    }
    throw new Error(`No occurrence of the target within maxFret=${maxFret}`);
  }

  submitAnswer(answer: Pos): AnswerResult<Pos> {
    if (!this.prompt) throw new Error('submitAnswer called before getNextPrompt');
    const elapsedMs = Date.now() - this.startedAt;
    const hit = this.expected.find(p => key(p) === key(answer));
    const correct = !!hit && !this.found.has(key(answer));
    if (correct) {
      this.found.add(key(answer));
      this.finds.push({ pos: hit!, elapsedMs });
    } else {
      this.hadWrong = true;
    }
    return this.finish(correct, correct ? [answer] : null, elapsedMs);
  }

  // Give up: completes the prompt as incorrect and returns what was missed.
  reveal(): AnswerResult<Pos> {
    if (!this.prompt) throw new Error('reveal called before getNextPrompt');
    const missed = this.expected.filter(p => !this.found.has(key(p)));
    this.hadWrong = true;
    const elapsedMs = Date.now() - this.startedAt;
    // Missed positions land in the heatmap as misses.
    for (const p of missed) { this.found.add(key(p)); this.finds.push({ pos: p, elapsedMs }); }
    this.finish(false, null, elapsedMs);
    return { correct: false, correctAnswers: missed, elapsedMs: 0, promptComplete: true };
  }

  private finish(correct: boolean, answers: Pos[] | null, elapsedMs: number): AnswerResult<Pos> {
    const remaining = this.expected.filter(p => !this.found.has(key(p)));
    const promptComplete = remaining.length === 0;
    if (promptComplete) {
      const clean = !this.hadWrong;
      this.attempts.push({ correct: clean, elapsedMs });
      for (const f of this.finds) this.stats.push({ pos: f.pos, correct: clean, elapsedMs: f.elapsedMs });
      this.prompt = null;
    }
    return { correct, correctAnswers: answers ?? remaining, elapsedMs, promptComplete };
  }

  notifyResumed(pauseDurationMs: number): void {
    this.startedAt += pauseDurationMs;
  }

  // Session totals are per prompt; the heatmap is per position (time to find
  // it, and whether its prompt was clean).
  getReport(): ExerciseReport {
    const total = this.attempts.length;
    const correct = this.attempts.filter(a => a.correct).length;
    const byPos = new Map<string, PerTargetStat & { totalTime: number }>();
    for (const s of this.stats) {
      const e = byPos.get(key(s.pos)) ?? { position: { string: s.pos.string as StringNum, fret: s.pos.fret }, timesAsked: 0, correctCount: 0, avgTimeMs: 0, totalTime: 0 };
      e.timesAsked += 1;
      if (s.correct) e.correctCount += 1;
      e.totalTime += s.elapsedMs;
      byPos.set(key(s.pos), e);
    }
    return {
      totalPrompts: total,
      correctCount: correct,
      incorrectCount: total - correct,
      accuracy: total === 0 ? 0 : correct / total,
      avgTimeMs: total === 0 ? 0 : this.attempts.reduce((n, a) => n + a.elapsedMs, 0) / total,
      perTargetStats: [...byPos.values()].map(({ totalTime, ...s }) => ({ ...s, avgTimeMs: totalTime / s.timesAsked })),
      attempts: this.attempts.map(a => ({ ...a }))
    };
  }
}
