import type { Exercise, AnswerResult } from '../Exercise';
import type {
  RootNotesConfig,
  RootNotesPrompt,
  RootNotesAnswer,
  RootNotesReport,
  PerTargetStat
} from './types';
import { noteAt, closestPositionOf, type Fret, type Note } from '../../music/notes';
import type { StringNum } from '../../music/tuning';

// The fixed pool the 'random-roots' exercise re-draws its target from on every
// prompt.
const RANDOM_ROOT_NOTES: Note[] = ['A', 'E', 'D'];

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

export class RootNotesExercise
  implements Exercise<RootNotesConfig, RootNotesPrompt, RootNotesAnswer, RootNotesReport>
{
  private config!: RootNotesConfig;
  private currentPrompt: RootNotesPrompt | null = null;
  private currentCorrect: Array<{ string: StringNum; fret: Fret }> | null = null;
  private promptStartedAt = 0;
  private prevPrompt: { string: StringNum; fret: Fret } | null = null;
  private attempts: AttemptLog[] = [];

  start(config: RootNotesConfig): void {
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
      return RANDOM_ROOT_NOTES[Math.floor(Math.random() * RANDOM_ROOT_NOTES.length)];
    }
    return this.config.targetNote;
  }

  getNextPrompt(): RootNotesPrompt {
    const maxFret = this.config.maxFret;
    let pick: { string: StringNum; fret: Fret };
    do {
      const string = ((Math.floor(Math.random() * 6) + 1) as StringNum);
      const fret = Math.floor(Math.random() * (maxFret + 1));
      pick = { string, fret };
    } while (
      this.prevPrompt &&
      pick.string === this.prevPrompt.string &&
      pick.fret === this.prevPrompt.fret
    );

    this.prevPrompt = pick;
    const targetNote = this.pickTarget();
    const prompt: RootNotesPrompt = {
      highlight: pick,
      highlightNote: noteAt(pick.string, pick.fret),
      targetNote
    };
    this.currentPrompt = prompt;
    this.currentCorrect = closestPositionOf(
      targetNote,
      pick,
      maxFret,
      this.config.algorithm
    );
    this.promptStartedAt = Date.now();
    return prompt;
  }

  submitAnswer(answer: RootNotesAnswer): AnswerResult<RootNotesAnswer> {
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
    const result: AnswerResult<RootNotesAnswer> = {
      correct,
      correctAnswers: this.currentCorrect,
      elapsedMs
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

  getReport(): RootNotesReport {
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
