import type { Exercise, AnswerResult } from '../Exercise';
import type { PlayShapeConfig, PlayShapePrompt, PlayShapeAnswer, ModesReport, Pos } from './types';
import { noteAt, pitchOf, allPositionsOf } from '../../music/notes';
import type { Mode } from '../../music/modes';
import { octaveFixedPositions, octaveSequencePitches, boxPositions } from './shape';
import { aggregateModesReport, type ModeAttempt } from './report';

function samePos(a: Pos, b: Pos): boolean {
  return a.string === b.string && a.fret === b.fret;
}

export class PlayShapeExercise
  implements Exercise<PlayShapeConfig, PlayShapePrompt, PlayShapeAnswer, ModesReport>
{
  private config!: PlayShapeConfig;
  private currentPrompt: PlayShapePrompt | null = null;
  private promptStartedAt = 0;
  private prev: { root: Pos; mode: Mode } | null = null;
  private attempts: ModeAttempt[] = [];

  // Per-prompt progress.
  private expectedPositions: Pos[] = [];   // octave/fixed and box
  private expectedPitches: number[] = [];  // octave/pitch
  private stepIndex = 0;                    // octave: next expected step
  private clicked: boolean[] = [];          // box: which set members hit
  private clickedCount = 0;                 // box
  private hadWrong = false;                 // any wrong click this prompt

  start(config: PlayShapeConfig): void {
    this.config = config;
    this.currentPrompt = null;
    this.promptStartedAt = 0;
    this.prev = null;
    this.attempts = [];
    this.resetProgress();
  }

  private resetProgress(): void {
    this.expectedPositions = [];
    this.expectedPitches = [];
    this.stepIndex = 0;
    this.clicked = [];
    this.clickedCount = 0;
    this.hadWrong = false;
  }

  private pickMode(): Mode {
    const pool = this.config.enabledModes;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getNextPrompt(): PlayShapePrompt {
    const { maxFret, shapeVariant, boxSpan } = this.config;
    let root: Pos;
    let mode: Mode;
    let positions: Pos[];
    let pitches: number[] = [];

    // Keep drawing until the shape is reachable within maxFret and the
    // (root, mode) pair differs from the previous prompt. Bounded so an
    // infeasible config (e.g. maxFret too small for any octave, or a
    // non-positive box span) throws instead of spinning the event loop and
    // freezing the tab.
    const MAX_ATTEMPTS = 500;
    let found = false;
    root = { string: 1, fret: 0 };
    mode = this.config.enabledModes[0];
    // Parallel framing: when a fixed root note is configured, every prompt uses
    // that pitch-class (still a random fretboard position of it), so the player
    // compares modes over one root. null = the original random-root behaviour.
    const rootPool = this.config.fixedRootNote
      ? allPositionsOf(this.config.fixedRootNote, maxFret)
      : null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let string: Pos['string'];
      let fret: number;
      if (rootPool) {
        if (rootPool.length === 0) continue; // no position for this note within maxFret
        const p = rootPool[Math.floor(Math.random() * rootPool.length)];
        string = p.string;
        fret = p.fret;
      } else {
        string = ((Math.floor(Math.random() * 6) + 1)) as Pos['string'];
        fret = Math.floor(Math.random() * (maxFret + 1));
      }
      root = { string, fret };
      mode = this.pickMode();

      if (this.prev && samePos(this.prev.root, root) && this.prev.mode === mode) {
        continue;
      }

      if (shapeVariant === 'octave') {
        const fixed = octaveFixedPositions(root, mode, maxFret);
        if (fixed === null) continue; // octave unreachable within maxFret
        positions = fixed;
        pitches = octaveSequencePitches(root, mode);
      } else {
        positions = boxPositions(root, mode, maxFret, boxSpan);
        if (positions.length === 0) continue;
      }
      found = true;
      break;
    }

    if (!found) {
      throw new Error(
        `No playable ${shapeVariant} shape for the enabled modes within maxFret=${maxFret}` +
        (shapeVariant === 'box' ? ` (boxSpan=${boxSpan})` : '')
      );
    }

    this.prev = { root, mode };
    this.resetProgress();
    if (shapeVariant === 'octave') {
      this.expectedPositions = positions!;
      this.expectedPitches = pitches;
    } else {
      this.expectedPositions = positions!;
      this.clicked = positions!.map(() => false);
    }

    const prompt: PlayShapePrompt = {
      root,
      rootNote: noteAt(root.string, root.fret),
      mode,
      variant: shapeVariant,
      expectedCount: positions!.length
    };
    this.currentPrompt = prompt;
    this.promptStartedAt = Date.now();
    return prompt;
  }

  submitAnswer(answer: PlayShapeAnswer): AnswerResult<PlayShapeAnswer> {
    if (!this.currentPrompt) {
      throw new Error('submitAnswer called before getNextPrompt');
    }
    const { shapeVariant, octaveJudge } = this.config;
    let correct: boolean;
    let correctAnswers: Pos[];

    if (shapeVariant === 'octave') {
      const expectedPos = this.expectedPositions[this.stepIndex];
      if (octaveJudge === 'fixed') {
        correct = samePos(answer, expectedPos);
      } else {
        correct = pitchOf(answer.string, answer.fret) === this.expectedPitches[this.stepIndex];
      }
      correctAnswers = [expectedPos];
      if (correct) this.stepIndex += 1;
    } else {
      // box: correct iff an un-clicked member of the set.
      const idx = this.expectedPositions.findIndex(p => samePos(p, answer));
      correct = idx >= 0 && !this.clicked[idx];
      if (correct) {
        this.clicked[idx] = true;
        this.clickedCount += 1;
      }
      correctAnswers = this.expectedPositions.filter((_, i) => !this.clicked[i]);
    }

    if (!correct) this.hadWrong = true;

    const promptComplete = shapeVariant === 'octave'
      ? this.stepIndex >= this.expectedPositions.length
      : this.clickedCount >= this.expectedPositions.length;

    const elapsedMs = Date.now() - this.promptStartedAt;

    if (promptComplete) {
      this.attempts.push({
        mode: this.currentPrompt.mode,
        correct: !this.hadWrong,
        elapsedMs
      });
      this.currentPrompt = null;
    }

    return { correct, correctAnswers, elapsedMs, promptComplete };
  }

  notifyResumed(pauseDurationMs: number): void {
    this.promptStartedAt += pauseDurationMs;
  }

  getReport(): ModesReport {
    return aggregateModesReport(this.attempts);
  }
}
