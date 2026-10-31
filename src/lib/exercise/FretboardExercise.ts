import type { Exercise, AnswerResult } from './Exercise';
import type {
  ExerciseConfig,
  ExercisePrompt,
  ExerciseAnswer,
  ExerciseReport,
  PerTargetStat
} from './types';
import { noteAt, closestPositionOf, CHROMATIC, type Fret, type Note } from '../music/notes';
import { scaleNotes, diatonicInterval, transpose, CHROMATIC_INTERVALS, type Interval, type ScaleQuality } from '../music/scales';
import type { StringNum } from '../music/tuning';

// The fixed pool the 'random-roots' exercise re-draws its target from on every
// prompt.
const RANDOM_ROOT_NOTES: Note[] = ['A', 'E', 'D'];

function randomOf<T>(xs: readonly T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

interface AttemptLog {
  // The canonical (lowest string, then lowest fret) position out of the tied
  // set, used as the stable key for per-target aggregation.
  correctPosition: { string: StringNum; fret: Fret };
  correct: boolean;
  elapsedMs: number;
}

function canonicalPosition(
  positions: Array<{ string: StringNum; fret: Fret }>
): { string: StringNum; fret: Fret } {
  let best = positions[0];
  for (let i = 1; i < positions.length; i++) {
    const p = positions[i];
    if (p.string < best.string || (p.string === best.string && p.fret < best.fret)) {
      best = p;
    }
  }
  return best;
}

export class FretboardExercise
  implements Exercise<ExerciseConfig, ExercisePrompt, ExerciseAnswer, ExerciseReport>
{
  private config!: ExerciseConfig;
  private currentPrompt: ExercisePrompt | null = null;
  private currentCorrect: Array<{ string: StringNum; fret: Fret }> | null = null;
  private promptStartedAt = 0;
  private prevPrompt: { string: StringNum; fret: Fret } | null = null;
  private attempts: AttemptLog[] = [];

  start(config: ExerciseConfig): void {
    this.config = config;
    this.currentPrompt = null;
    this.currentCorrect = null;
    this.promptStartedAt = 0;
    this.prevPrompt = null;
    this.attempts = [];
  }

  // For 'root-notes' the target is fixed at config.targetNote; for
  // 'random-roots' it is re-drawn uniformly from RANDOM_ROOT_NOTES each prompt.
  private pickTarget(): Note {
    if (this.config.exercise === 'random-roots') {
      return randomOf(RANDOM_ROOT_NOTES);
    }
    return this.config.targetNote;
  }

  // A random fretboard position, never a repeat of the previous prompt. When
  // `allowed` is given, only positions whose note is in that set are drawn.
  // Reject sampling with bounded tries: throws rather than spinning forever if
  // the constraints can't be met (e.g. a key with no in-scale position within
  // maxFret — only reachable at a degenerate maxFret the UI never offers).
  private pickPosition(allowed?: Set<Note>): { string: StringNum; fret: Fret } {
    const maxFret = this.config.maxFret;
    const MAX_TRIES = 1000;
    for (let tries = 0; tries < MAX_TRIES; tries++) {
      const string = ((Math.floor(Math.random() * 6) + 1) as StringNum);
      const fret = Math.floor(Math.random() * (maxFret + 1));
      const pick = { string, fret };
      const outOfScale = allowed && !allowed.has(noteAt(pick.string, pick.fret));
      const repeat = this.prevPrompt &&
        pick.string === this.prevPrompt.string &&
        pick.fret === this.prevPrompt.fret;
      if (!outOfScale && !repeat) return pick;
    }
    throw new Error(`Could not pick a prompt position within maxFret=${maxFret}`);
  }

  getNextPrompt(): ExercisePrompt {
    const prompt = this.config.exercise === 'intervals'
      ? this.nextIntervalPrompt()
      : this.nextNotePrompt();
    this.prevPrompt = prompt.highlight;
    this.currentPrompt = prompt;
    this.currentCorrect = closestPositionOf(
      prompt.targetNote,
      prompt.highlight,
      this.config.maxFret,
      this.config.algorithm,
      this.config.direction
    );
    this.promptStartedAt = Date.now();
    return prompt;
  }

  private nextNotePrompt(): ExercisePrompt {
    const pick = this.pickPosition();
    return {
      highlight: pick,
      highlightNote: noteAt(pick.string, pick.fret),
      targetNote: this.pickTarget()
    };
  }

  // Resolves key + interval (each fixed or re-drawn per prompt), picks a shown
  // note that is diatonic to that key, and targets its diatonic interval
  // ('diatonic-from-note'), or shows the key root and targets a chromatic
  // interval above it ('from-root').
  private nextIntervalPrompt(): ExercisePrompt {
    const keyRoot = this.config.keyRoot === 'random'
      ? randomOf(CHROMATIC)
      : this.config.keyRoot;
    const keyQuality: ScaleQuality = this.config.keyQuality === 'random'
      ? randomOf(['major', 'minor'] as const)
      : this.config.keyQuality;
    const interval: Interval = randomOf(this.config.intervals);

    if (this.config.intervalRef === 'from-root') {
      // Measured from the key root (shown), chromatically: b7, #4, b3...
      const flavour = randomOf(CHROMATIC_INTERVALS[interval]);
      const pick = this.pickPosition(new Set([keyRoot]));
      const targetNote = transpose(keyRoot, flavour.semis);
      return { highlight: pick, highlightNote: keyRoot, targetNote, interval, intervalLabel: flavour.label, keyRoot, keyQuality };
    }

    const scale = scaleNotes(keyRoot, keyQuality);
    const pick = this.pickPosition(new Set(scale));
    const highlightNote = noteAt(pick.string, pick.fret);
    // Non-null: highlightNote was drawn from the scale.
    const targetNote = diatonicInterval(keyRoot, keyQuality, highlightNote, interval)!;

    return { highlight: pick, highlightNote, targetNote, interval, keyRoot, keyQuality };
  }

  submitAnswer(answer: ExerciseAnswer): AnswerResult<ExerciseAnswer> {
    if (!this.currentPrompt || !this.currentCorrect) {
      throw new Error('submitAnswer called before getNextPrompt');
    }
    const elapsedMs = Date.now() - this.promptStartedAt;
    const correct = this.currentCorrect.some(
      p => p.string === answer.string && p.fret === answer.fret
    );
    this.attempts.push({
      correctPosition: canonicalPosition(this.currentCorrect),
      correct,
      elapsedMs
    });
    const result: AnswerResult<ExerciseAnswer> = {
      correct,
      correctAnswers: this.currentCorrect,
      elapsedMs,
      promptComplete: true
    };
    this.currentPrompt = null;
    this.currentCorrect = null;
    return result;
  }

  // Called when a session resumes from a pause. Shifts the in-flight
  // prompt's start time forward so the eventual submitAnswer measurement
  // doesn't include time the player spent paused.
  notifyResumed(pauseDurationMs: number): void {
    this.promptStartedAt += pauseDurationMs;
  }

  getReport(): ExerciseReport {
    const total = this.attempts.length;
    const correct = this.attempts.filter(a => a.correct).length;
    const incorrect = total - correct;
    const accuracy = total === 0 ? 0 : correct / total;
    const avgTimeMs = total === 0
      ? 0
      : this.attempts.reduce((sum, a) => sum + a.elapsedMs, 0) / total;

    const byKey = new Map<string, { stat: PerTargetStat; totalTime: number }>();
    for (const a of this.attempts) {
      const key = `${a.correctPosition.string}-${a.correctPosition.fret}`;
      const entry = byKey.get(key) ?? {
        stat: {
          position: a.correctPosition,
          timesAsked: 0,
          correctCount: 0,
          avgTimeMs: 0
        },
        totalTime: 0
      };
      entry.stat.timesAsked += 1;
      if (a.correct) entry.stat.correctCount += 1;
      entry.totalTime += a.elapsedMs;
      byKey.set(key, entry);
    }
    const perTargetStats: PerTargetStat[] = [];
    for (const { stat, totalTime } of byKey.values()) {
      perTargetStats.push({
        ...stat,
        avgTimeMs: totalTime / stat.timesAsked
      });
    }

    return {
      totalPrompts: total,
      correctCount: correct,
      incorrectCount: incorrect,
      accuracy,
      avgTimeMs,
      perTargetStats,
      attempts: this.attempts.map(a => ({ elapsedMs: a.elapsedMs, correct: a.correct }))
    };
  }
}
