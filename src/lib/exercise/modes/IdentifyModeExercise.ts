import type { Exercise, AnswerResult } from '../Exercise';
import type {
  IdentifyModeConfig,
  IdentifyModePrompt,
  IdentifyModeAnswer,
  ModesReport,
  Pos
} from './types';
import { allPositionsOf, noteAt } from '../../music/notes';
import { octaveFixedPositions } from './shape';
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
    // Parallel framing: a fixed root note holds the tonal centre constant across
    // prompts (random position of that pitch-class). null = random root. A fixed
    // root with no position within maxFret degrades to random roots.
    const rawPool = this.config.fixedRootNote
      ? allPositionsOf(this.config.fixedRootNote, maxFret)
      : null;
    const rootPool = rawPool && rawPool.length > 0 ? rawPool : null;
    // Audio prompt plays the one-octave run, so the drawn root+mode must have a
    // reachable octave shape — otherwise the prompt would be silent AND hidden.
    const needsPlayableOctave = this.config.promptMode === 'audio';
    let root: Pos = { string: 1, fret: 0 };
    let mode: Mode = this.config.enabledModes[0];
    const MAX_ATTEMPTS = 500;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (rootPool) {
        const p = rootPool[Math.floor(Math.random() * rootPool.length)];
        root = { string: p.string, fret: p.fret as Fret };
      } else {
        const string = ((Math.floor(Math.random() * 6) + 1)) as StringNum;
        const fret = Math.floor(Math.random() * (maxFret + 1));
        root = { string, fret };
      }
      mode = this.pickMode();
      if (this.prev && samePos(this.prev.root, root) && this.prev.mode === mode) continue;
      if (needsPlayableOctave && octaveFixedPositions(root, mode, maxFret) === null) continue;
      break;
    }

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
