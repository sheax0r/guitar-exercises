import type { AnswerResult } from '../Exercise';
import type { ChordTonesConfig, ChordTonesPrompt, ChordTonesReport, ToneKind } from './types';
import { CHROMATIC, noteAt, closestPositionOf, type Note } from '../../music/notes';
import { transpose } from '../../music/scales';
import { chordNotes, type ChordType, type Pos } from '../../music/caged';
import { progressionChords, type ProgressionChord } from '../../music/progressions';
import { STANDARD_TUNING_MIDI, type StringNum } from '../../music/tuning';
import { aggregateGrouped } from '../modes/report';

// Mic: how far (in frets) a heard note may sit from the expected position.
export const MIC_NEAR_FRETS = 3;

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const same = (a: Pos, b: Pos) => a.string === b.string && a.fret === b.fret;

export class ChordTonesExercise {
  private config!: ChordTonesConfig;
  private chords: ProgressionChord[] = [];
  private key: Note = 'C';
  private nextKey: Note | null = null;
  private index = -1;
  private count = 0;
  private prev: Pos | null = null;
  private prompt: ChordTonesPrompt | null = null;
  private accepted: Pos[] = [];
  private answered = false;
  private startedAt = 0;
  private attempts: Array<{ numeral: string; tone: ToneKind; correct: boolean; elapsedMs: number }> = [];

  start(config: ChordTonesConfig): void {
    this.config = config;
    this.chords = progressionChords(config.progression);
    this.index = -1;
    this.nextKey = null;
    this.count = 0;
    this.prev = null;
    this.prompt = null;
    this.attempts = [];
  }

  // The chord the next getNextPrompt() will ask about, so timed backing can
  // sound it on the beat before the prompt opens. Draws the next loop's key.
  upcoming(): { numeral: string; chordRoot: Note; chordType: ChordType; bars: number } {
    const i = (this.index + 1) % this.chords.length;
    if (i === 0 && this.nextKey === null) {
      this.nextKey = this.config.keyRoot === 'random' ? pick(CHROMATIC) : this.config.keyRoot;
    }
    const c = this.chords[i];
    return { numeral: c.numeral, chordRoot: transpose(i === 0 ? this.nextKey! : this.key, c.semis), chordType: c.type, bars: c.bars };
  }

  // Moves to the next chord change. An unanswered prompt is a missed change.
  getNextPrompt(): ChordTonesPrompt {
    if (this.prompt && !this.answered) this.record(false, this.accepted[0]);
    const { maxFret, target, algorithm } = this.config;
    const up = this.upcoming();
    this.index = (this.index + 1) % this.chords.length;
    if (this.index === 0) {
      this.key = this.nextKey!;
      this.nextKey = null;
    }
    const from: Pos = this.prev ?? {
      string: (Math.floor(Math.random() * 6) + 1) as StringNum,
      fret: Math.floor(Math.random() * (maxFret + 1))
    };
    const { chordRoot, chordType, numeral, bars } = up;
    const notes = chordNotes(chordRoot, chordType);
    const tone: ToneKind = target === 'guide' ? (this.count % 2 === 0 ? '3rd' : '7th') : target;
    const targetNotes = tone === '3rd' ? [notes[1]] : tone === '7th' ? [notes[3]]
      : notes.filter(n => n !== noteAt(from.string, from.fret));
    this.accepted = closestPositionOf(targetNotes, from, maxFret, algorithm, 'nearest');
    this.prompt = {
      keyRoot: this.key, index: this.index, numeral, chordRoot, chordType, bars, tone, targetNotes, from
    };
    this.count += 1;
    this.answered = false;
    this.startedAt = Date.now();
    return this.prompt;
  }

  // The positions accepted for the current prompt.
  expected(): Pos[] {
    return this.accepted;
  }

  isAnswered(): boolean {
    return this.answered;
  }

  submitAnswer(pos: Pos): AnswerResult<Pos> {
    const correct = this.accepted.some(a => same(a, pos));
    return this.record(correct, correct ? pos : this.accepted[0]);
  }

  // A heard pitch: right pitch class, playable within MIC_NEAR_FRETS of an
  // expected position. The next origin is where it was most likely played.
  submitMicNote(midi: number): AnswerResult<Pos> {
    const { maxFret } = this.config;
    const fretGap = (p: Pos) => Math.min(...this.accepted.map(a => Math.abs(a.fret - p.fret)));
    const playable: Pos[] = [];
    for (let s = 1 as StringNum; s <= 6; s = (s + 1) as StringNum) {
      const fret = midi - STANDARD_TUNING_MIDI[s];
      if (fret >= 0 && fret <= maxFret) playable.push({ string: s, fret });
    }
    playable.sort((a, b) => fretGap(a) - fretGap(b));
    const heard = playable[0];
    const correct = !!heard && this.prompt!.targetNotes.includes(CHROMATIC[midi % 12]) && fretGap(heard) <= MIC_NEAR_FRETS;
    return this.record(correct, correct ? heard : this.accepted[0]);
  }

  private record(correct: boolean, next: Pos): AnswerResult<Pos> {
    const p = this.prompt;
    if (!p || this.answered) throw new Error('No open prompt to answer');
    const elapsedMs = Date.now() - this.startedAt;
    this.attempts.push({ numeral: p.numeral, tone: p.tone, correct, elapsedMs });
    this.answered = true;
    this.prev = next;
    return { correct, correctAnswers: this.accepted, elapsedMs, promptComplete: true };
  }

  notifyResumed(pauseDurationMs: number): void {
    this.startedAt += pauseDurationMs;
  }

  getReport(): ChordTonesReport {
    const byChord = aggregateGrouped(this.attempts.map(a => ({ ...a, key: a.numeral })));
    const byTone = aggregateGrouped(this.attempts.map(a => ({ ...a, key: a.tone })));
    const { groups, ...rest } = byChord;
    return {
      ...rest,
      perChordStats: groups.map(({ key, ...s }) => ({ numeral: key, ...s })),
      perToneStats: byTone.groups.map(({ key, ...s }) => ({ tone: key, ...s }))
    };
  }
}
