import type { Exercise, AnswerResult } from '../Exercise';
import type {
  IdentifyModeConfig,
  IdentifyModePrompt,
  IdentifyModeAnswer,
  ModesReport,
  Pos
} from './types';
import { allPositionsOf, noteAt } from '../../music/notes';
import { scaleNotes, type Mode } from '../../music/modes';
import type { StringNum } from '../../music/tuning';
import type { Fret } from '../../music/notes';
import { aggregateModesReport, type ModeAttempt } from './report';

function samePos(a: Pos, b: Pos): boolean {
  return a.string === b.string && a.fret === b.fret;
}

export class IdentifyModeExercise
  implements Exercise<IdentifyModeConfig, IdentifyModePrompt, IdentifyModeAnswer, ModesReport>
{
  private config!: IdentifyModeConfig;
  private currentPrompt: IdentifyModePrompt | null = null;
  private promptStartedAt = 0;
  private prev: { root: Pos; mode: Mode } | null = null;
  private attempts: ModeAttempt[] = [];

  start(config: IdentifyModeConfig): void {
    this.config = config;
    this.currentPrompt = null;
    this.promptStartedAt = 0;
    this.prev = null;
    this.attempts = [];
  }

  private pickMode(): Mode {
    const pool = this.config.enabledModes;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getNextPrompt(): IdentifyModePrompt {
    const { maxFret } = this.config;
    let root: Pos;
    let mode: Mode;
    do {
      const string = ((Math.floor(Math.random() * 6) + 1)) as StringNum;
      const fret = Math.floor(Math.random() * (maxFret + 1));
      root = { string, fret };
      mode = this.pickMode();
    } while (this.prev && samePos(this.prev.root, root) && this.prev.mode === mode);

    const rootNote = noteAt(root.string, root.fret);
    const classes = scaleNotes(rootNote, mode);
    const positions: Pos[] = [];
    for (const n of classes) {
      for (const p of allPositionsOf(n, maxFret)) {
        positions.push({ string: p.string, fret: p.fret as Fret });
      }
    }
    const rootPositions = allPositionsOf(rootNote, maxFret).map(p => ({
      string: p.string,
      fret: p.fret as Fret
    }));

    this.prev = { root, mode };
    const prompt: IdentifyModePrompt = { root, rootNote, mode, positions, rootPositions };
    this.currentPrompt = prompt;
    this.promptStartedAt = Date.now();
    return prompt;
  }

  submitAnswer(answer: IdentifyModeAnswer): AnswerResult<IdentifyModeAnswer> {
    if (!this.currentPrompt) {
      throw new Error('submitAnswer called before getNextPrompt');
    }
    const elapsedMs = Date.now() - this.promptStartedAt;
    const correct = answer.mode === this.currentPrompt.mode;
    this.attempts.push({ mode: this.currentPrompt.mode, correct, elapsedMs });
    const result: AnswerResult<IdentifyModeAnswer> = {
      correct,
      correctAnswers: [{ mode: this.currentPrompt.mode }],
      elapsedMs,
      promptComplete: true
    };
    this.currentPrompt = null;
    return result;
  }

  notifyResumed(pauseDurationMs: number): void {
    this.promptStartedAt += pauseDurationMs;
  }

  getReport(): ModesReport {
    return aggregateModesReport(this.attempts);
  }
}
