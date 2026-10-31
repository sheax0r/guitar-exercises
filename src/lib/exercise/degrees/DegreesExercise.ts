import type { Exercise, AnswerResult } from '../Exercise';
import type { DegreesConfig, DegreesPrompt, DegreesAnswer, DegreesReport } from './types';
import { CHROMATIC, noteAt, closestPositionOf, type Note } from '../../music/notes';
import { DEGREE_LABELS, degreeOf, transpose, type Degree } from '../../music/scales';
import type { Pos } from '../../music/caged';
import type { StringNum } from '../../music/tuning';
import { aggregateGrouped } from '../modes/report';

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

export class DegreesExercise implements Exercise<DegreesConfig, DegreesPrompt, DegreesAnswer, DegreesReport> {
  private config!: DegreesConfig;
  private prompt: DegreesPrompt | null = null;
  private accepted: Pos[] = [];   // 'find': the nearest target positions
  private prev: Pos | null = null;
  private startedAt = 0;
  private attempts: Array<{ key: Degree; correct: boolean; elapsedMs: number }> = [];

  start(config: DegreesConfig): void {
    this.config = config;
    this.prompt = null;
    this.prev = null;
    this.attempts = [];
  }

  getNextPrompt(): DegreesPrompt {
    const { maxFret, degreeVariant: variant } = this.config;
    const keyRoot: Note = this.config.keyRoot === 'random' ? pick(CHROMATIC) : this.config.keyRoot;
    // 'find' asks for a degree; 'name' shows a note whose degree is the answer.
    let degree: Degree = pick(DEGREE_LABELS);
    let targetNote = transpose(keyRoot, DEGREE_LABELS.indexOf(degree));
    let highlight: Pos | null = null;
    for (let tries = 0; tries < 1000 && !highlight; tries++) {
      const p: Pos = { string: (Math.floor(Math.random() * 6) + 1) as StringNum, fret: Math.floor(Math.random() * (maxFret + 1)) };
      if (this.prev && p.string === this.prev.string && p.fret === this.prev.fret) continue;
      // 'find': don't start on the answer itself.
      if (variant === 'find' && noteAt(p.string, p.fret) === targetNote) continue;
      highlight = p;
    }
    if (!highlight) throw new Error(`Could not pick a prompt position within maxFret=${maxFret}`);
    if (variant === 'name') {
      targetNote = noteAt(highlight.string, highlight.fret);
      degree = degreeOf(keyRoot, targetNote);
    }
    this.accepted = variant === 'find'
      ? closestPositionOf(targetNote, highlight, maxFret, this.config.algorithm, 'nearest')
      : [];
    this.prev = highlight;
    this.prompt = { variant, keyRoot, degree, highlight, targetNote };
    this.startedAt = Date.now();
    return this.prompt;
  }

  submitAnswer(answer: DegreesAnswer): AnswerResult<DegreesAnswer> {
    const p = this.prompt;
    if (!p) throw new Error('submitAnswer called before getNextPrompt');
    const correct = 'degree' in answer
      ? answer.degree === p.degree
      : this.accepted.some(a => a.string === answer.string && a.fret === answer.fret);
    const elapsedMs = Date.now() - this.startedAt;
    this.attempts.push({ key: p.degree, correct, elapsedMs });
    this.prompt = null;
    const correctAnswers: DegreesAnswer[] = p.variant === 'name' ? [{ degree: p.degree }] : this.accepted;
    return { correct, correctAnswers, elapsedMs, promptComplete: true };
  }

  notifyResumed(pauseDurationMs: number): void {
    this.startedAt += pauseDurationMs;
  }

  getReport(): DegreesReport {
    const { groups, ...rest } = aggregateGrouped(this.attempts);
    return { ...rest, perDegreeStats: groups.map(({ key, ...s }) => ({ degree: key, ...s })) };
  }
}
