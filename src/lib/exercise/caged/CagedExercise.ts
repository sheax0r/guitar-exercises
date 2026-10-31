import type { Exercise, AnswerResult } from '../Exercise';
import type { CagedConfig, CagedPrompt, CagedAnswer, CagedReport } from './types';
import { CHROMATIC, noteAt, pitchOf, type Note } from '../../music/notes';
import {
  cagedInstances,
  chordPositions,
  chordTypesFor,
  nextShapeInstance,
  type CagedShape,
  type Pos
} from '../../music/caged';
import { aggregateGrouped } from '../modes/report';

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const samePos = (a: Pos, b: Pos) => a.string === b.string && a.fret === b.fret;

export class CagedExercise implements Exercise<CagedConfig, CagedPrompt, CagedAnswer, CagedReport> {
  private config!: CagedConfig;
  private prompt: CagedPrompt | null = null;
  private prevKey = '';
  private startedAt = 0;
  private attempts: Array<{ key: CagedShape; correct: boolean; elapsedMs: number }> = [];
  // Click/mic progress for find-tones and next-shape.
  private expected: Pos[] = [];
  private hit: boolean[] = [];
  private hadWrong = false;

  start(config: CagedConfig): void {
    this.config = config;
    this.prompt = null;
    this.prevKey = '';
    this.attempts = [];
  }

  getNextPrompt(): CagedPrompt {
    const { cagedVariant: variant, enabledShapes, maxFret, fixedRootNote } = this.config;
    const types = chordTypesFor(this.config.qualities, this.config.include7th);
    // Bounded redraw: an infeasible config (a fixed root whose shapes don't fit
    // in maxFret) throws instead of freezing the tab.
    for (let attempt = 0; attempt < 500; attempt++) {
      const rootNote: Note = fixedRootNote ?? pick([...CHROMATIC]);
      const chord = pick(types);
      const instances = cagedInstances(pick(enabledShapes), rootNote, maxFret);
      if (instances.length === 0) continue;
      const from = pick(instances);
      const key = `${from.shape}${from.root.fret}${rootNote}${chord}`;
      // Avoid an exact repeat, unless the config allows only one prompt.
      if (key === this.prevKey && attempt < 100) continue;
      const shown = chordPositions(rootNote, chord, from.window);

      let askedShape = from.shape;
      let expected = shown;
      if (variant === 'next-shape') {
        const to = nextShapeInstance(from, rootNote, maxFret);
        if (!to) continue;
        askedShape = to.shape;
        expected = chordPositions(rootNote, chord, to.window).filter(p => noteAt(p.string, p.fret) === rootNote);
      }

      this.prevKey = key;
      this.expected = variant === 'name-shape' ? [] : expected;
      this.hit = this.expected.map(() => false);
      this.hadWrong = false;
      this.prompt = {
        variant,
        shape: askedShape,
        fromShape: variant === 'next-shape' ? from.shape : null,
        rootNote,
        chord,
        anchor: from.root,
        window: from.window,
        shownPositions: variant === 'find-tones' ? [] : shown,
        expectedCount: variant === 'name-shape' ? 1 : expected.length
      };
      this.startedAt = Date.now();
      return this.prompt;
    }
    throw new Error(`No CAGED shape fits within maxFret=${maxFret} for this config`);
  }

  submitAnswer(answer: CagedAnswer): AnswerResult<CagedAnswer> {
    const p = this.prompt;
    if (!p) throw new Error('submitAnswer called before getNextPrompt');
    if ('shape' in answer) {
      const correct = answer.shape === p.shape && answer.root === p.rootNote;
      if (!correct) this.hadWrong = true;
      return this.finish(correct, [{ shape: p.shape, root: p.rootNote }], true);
    }
    const idx = this.expected.findIndex((e, i) => !this.hit[i] && samePos(e, answer));
    return this.claim(idx);
  }

  // Mic (find-tones): a heard pitch claims the lowest un-hit window position of
  // that pitch class, so repeated notes fill the window bottom-up.
  submitMicNote(midi: number): AnswerResult<Pos> {
    if (!this.prompt) throw new Error('submitMicNote called before getNextPrompt');
    const pc = ((midi % 12) + 12) % 12;
    let best = -1;
    this.expected.forEach((e, i) => {
      const pitch = pitchOf(e.string, e.fret);
      if (this.hit[i] || pitch % 12 !== pc) return;
      if (best < 0 || pitch < pitchOf(this.expected[best].string, this.expected[best].fret)) best = i;
    });
    return this.claim(best) as AnswerResult<Pos>;
  }

  private claim(idx: number): AnswerResult<CagedAnswer> {
    const correct = idx >= 0;
    if (correct) this.hit[idx] = true;
    else this.hadWrong = true;
    const remaining = this.expected.filter((_, i) => !this.hit[i]);
    return this.finish(correct, correct ? [this.expected[idx]] : remaining, remaining.length === 0);
  }

  private finish(correct: boolean, correctAnswers: CagedAnswer[], promptComplete: boolean): AnswerResult<CagedAnswer> {
    const elapsedMs = Date.now() - this.startedAt;
    if (promptComplete && this.prompt) {
      this.attempts.push({ key: this.prompt.shape, correct: !this.hadWrong, elapsedMs });
      this.prompt = null;
    }
    return { correct, correctAnswers, elapsedMs, promptComplete };
  }

  notifyResumed(pauseDurationMs: number): void {
    this.startedAt += pauseDurationMs;
  }

  getReport(): CagedReport {
    const { groups, ...rest } = aggregateGrouped(this.attempts);
    return { ...rest, perShapeStats: groups.map(({ key, ...s }) => ({ shape: key, ...s })) };
  }
}
