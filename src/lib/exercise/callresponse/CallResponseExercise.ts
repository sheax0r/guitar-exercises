import type { CallResponseConfig, CallResponsePrompt, CallResponseReport, NoteResult, PhraseNote } from './types';
import { PHRASE_BPM, PHRASE_DEGREES } from './types';
import { CHROMATIC, type Note } from '../../music/notes';
import { DEGREE_LABELS, type Degree } from '../../music/scales';
import { toSixteenths } from '../../transcribe/quantize';
import { aggregateGrouped } from '../modes/report';

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const pc = (midi: number) => ((midi % 12) + 12) % 12;

export class CallResponseExercise {
  private config!: CallResponseConfig;
  private prompt: CallResponsePrompt | null = null;
  private matched = 0;
  private firstNote = 0;   // index into `notes` where this phrase's records start
  private times: number[] = [];
  private startedAt = 0;
  private phrases: Array<{ length: number; correct: boolean; elapsedMs: number }> = [];
  private notes: Array<{ degree: Degree; correct: boolean; elapsedMs: number }> = [];

  start(config: CallResponseConfig): void {
    this.config = config;
    this.prompt = null;
    this.phrases = [];
    this.notes = [];
  }

  getNextPrompt(): CallResponsePrompt {
    const { keyRoot: fixed, degrees, lengths, motion, rhythm } = this.config;
    const keyRoot: Note = fixed === 'random' ? pick(CHROMATIC) : fixed;
    // Root in E3..D#4; the pool runs up to the octave.
    let root = 48 + CHROMATIC.indexOf(keyRoot);
    if (root < 52) root += 12;
    const pool: Array<{ midi: number; degree: Degree }> = PHRASE_DEGREES
      .filter(d => degrees.includes(d))
      .map(d => ({ midi: root + DEGREE_LABELS.indexOf(d), degree: d }));
    if (degrees.includes('1')) pool.push({ midi: root + 12, degree: '1' });
    const length = pick(lengths);
    let i = Math.floor(Math.random() * pool.length);
    const notes: PhraseNote[] = [];
    for (let k = 0; k < length; k++) {
      if (k > 0) {
        const next = pool.map((_, j) => j).filter(j => j !== i && (motion === 'leaps' || Math.abs(j - i) === 1));
        i = pick(next);
      }
      const { midi, degree } = pool[i];
      notes.push({ midi, degree, note: CHROMATIC[pc(midi)], sixteenths: rhythm ? pick([2, 4]) : 4 });
    }
    this.prompt = { keyRoot, notes };
    this.matched = 0;
    this.firstNote = this.notes.length;
    this.times = [];
    this.startedAt = Date.now();
    return this.prompt;
  }

  // Call when playback ends: the response clock starts then.
  markListening(): void {
    this.startedAt = Date.now();
  }

  // The next note of the response, any octave. `atSec` (mic onset time)
  // enables rhythm judging; clicks pass none.
  submitNote(midi: number, atSec?: number): NoteResult {
    const p = this.prompt;
    if (!p) throw new Error('No open phrase');
    const target = p.notes[this.matched];
    const noteCorrect = pc(midi) === pc(target.midi);
    this.notes.push({ degree: target.degree, correct: noteCorrect, elapsedMs: 0 });
    if (!noteCorrect) return this.finish(false, false, false);
    this.matched += 1;
    if (atSec !== undefined) this.times.push(atSec);
    if (this.matched < p.notes.length) return { noteCorrect, done: false, correct: false, rhythmOff: false, matched: this.matched };
    const rhythmOff = this.config.rhythm && this.times.length === p.notes.length
      && this.times.slice(1).some((t, k) => toSixteenths(t - this.times[k], PHRASE_BPM) !== p.notes[k].sixteenths);
    return this.finish(true, !rhythmOff, rhythmOff);
  }

  // Give up: the phrase counts as a miss.
  skip(): void {
    if (this.prompt) this.finish(false, false, false);
  }

  private finish(noteCorrect: boolean, correct: boolean, rhythmOff: boolean): NoteResult {
    const elapsedMs = Date.now() - this.startedAt;
    this.phrases.push({ length: this.prompt!.notes.length, correct, elapsedMs });
    // This phrase's note records get the phrase time.
    for (let k = this.firstNote; k < this.notes.length; k++) this.notes[k].elapsedMs = elapsedMs;
    this.prompt = null;
    return { noteCorrect, done: true, correct, rhythmOff, matched: this.matched };
  }

  notifyResumed(pauseDurationMs: number): void {
    this.startedAt += pauseDurationMs;
  }

  getReport(): CallResponseReport {
    const byLength = aggregateGrouped(this.phrases.map(a => ({ ...a, key: a.length })));
    const byDegree = aggregateGrouped(this.notes.map(a => ({ ...a, key: a.degree })));
    const { groups, ...rest } = byLength;
    return {
      ...rest,
      perLengthStats: groups.map(({ key, ...s }) => ({ length: key, ...s })).sort((a, b) => a.length - b.length),
      perDegreeStats: byDegree.groups.map(({ key, ...s }) => ({ degree: key, ...s }))
        .sort((a, b) => DEGREE_LABELS.indexOf(a.degree) - DEGREE_LABELS.indexOf(b.degree))
    };
  }
}
