import type { LickDrillConfig, LickDrillReport, LickPrompt } from './types';
import type { NoteResult } from '../callresponse/types';
import { placeLick } from './lick';
import { CHROMATIC, type Note } from '../../music/notes';
import type { StringNum } from '../../music/tuning';
import { aggregateGrouped } from '../modes/report';

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const pc = (midi: number) => ((midi % 12) + 12) % 12;
const STRINGS: StringNum[] = [1, 2, 3, 4, 5, 6];
// Nearest signed shift (-6..5) from pitch class `from` to `to`.
const shiftOf = (from: number, to: number) => ((to - from + 18) % 12) - 6;

// Same in-order rule as Call and Response: pitch class at any octave, the first wrong note
// ends the lick, and notes after it aren't counted. Clicks also carry the string, and the
// first note must be on the asked start string.
export class LickDrillExercise {
  private config!: LickDrillConfig;
  private prompt: LickPrompt | null = null;
  private matched = 0;
  private firstNote = 0;
  private startedAt = 0;
  private licks: Array<{ shift: number; keyRoot: Note; correct: boolean; elapsedMs: number }> = [];
  private notes: Array<{ index: number; correct: boolean; elapsedMs: number }> = [];

  start(config: LickDrillConfig): void {
    this.config = config;
    this.prompt = null;
    this.licks = [];
    this.notes = [];
  }

  getNextPrompt(): LickPrompt {
    const { lick, target, startString, maxFret } = this.config;
    const from = pc(lick[0]);
    const call = placeLick(lick, null, 24)!.pos;
    let placed: ReturnType<typeof placeLick> = null;
    let to = from;
    let str: StringNum | null = null;
    for (let tries = 0; !placed && tries < 50; tries++) {
      to = target === 'same' ? from
        : target === 'random' ? pick(CHROMATIC.map((_, i) => i).filter(i => i !== from))
        : CHROMATIC.indexOf(target);
      str = startString === 'random' ? pick(STRINGS) : startString === 'any' ? null : startString;
      placed = placeLick(lick.map(m => m + shiftOf(from, to)), str, maxFret);
    }
    // ponytail: an unplayable ask (tiny fret range) falls back to the original lick, any string.
    if (!placed) { to = from; str = null; placed = placeLick(lick, null, 24)!; }
    this.prompt = {
      keyRoot: CHROMATIC[to],
      shift: shiftOf(from, to),
      startString: str,
      call,
      answer: placed.pos,
      notes: placed.notes.map(midi => ({ midi, note: CHROMATIC[pc(midi)], sixteenths: 2 }))
    };
    this.matched = 0;
    this.firstNote = this.notes.length;
    this.startedAt = Date.now();
    return this.prompt;
  }

  markListening(): void {
    this.startedAt = Date.now();
  }

  // `string` comes with clicks; the mic can't tell strings, so it passes none.
  submitNote(midi: number, _atSec?: number, string?: StringNum): NoteResult {
    const p = this.prompt;
    if (!p) throw new Error('No open lick');
    const target = p.notes[this.matched];
    const onString = this.matched > 0 || string === undefined || p.startString === null || string === p.startString;
    const noteCorrect = onString && pc(midi) === pc(target.midi);
    this.notes.push({ index: this.matched + 1, correct: noteCorrect, elapsedMs: 0 });
    if (!noteCorrect) return this.finish(false);
    this.matched += 1;
    if (this.matched < p.notes.length) return { noteCorrect, done: false, correct: false, rhythmOff: false, matched: this.matched };
    return this.finish(true);
  }

  // Give up: the lick counts as a miss.
  skip(): void {
    if (this.prompt) this.finish(false);
  }

  private finish(correct: boolean): NoteResult {
    const elapsedMs = Date.now() - this.startedAt;
    const p = this.prompt!;
    this.licks.push({ shift: p.shift, keyRoot: p.keyRoot, correct, elapsedMs });
    for (let k = this.firstNote; k < this.notes.length; k++) this.notes[k].elapsedMs = elapsedMs;
    this.prompt = null;
    return { noteCorrect: correct, done: true, correct, rhythmOff: false, matched: this.matched };
  }

  notifyResumed(pauseDurationMs: number): void {
    this.startedAt += pauseDurationMs;
  }

  getReport(): LickDrillReport {
    const { groups, ...rest } = aggregateGrouped(this.licks.map(a => ({ ...a, key: a.shift })));
    const byIndex = aggregateGrouped(this.notes.map(a => ({ ...a, key: a.index })));
    return {
      ...rest,
      perShiftStats: groups
        .map(({ key, ...s }) => ({ shift: key, keyRoot: this.licks.find(l => l.shift === key)!.keyRoot, ...s }))
        .sort((a, b) => a.shift - b.shift),
      perIndexStats: byIndex.groups.map(({ key, ...s }) => ({ index: key, ...s })).sort((a, b) => a.index - b.index)
    };
  }
}
