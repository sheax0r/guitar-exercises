import type { Exercise, AnswerResult } from '../Exercise';
import type { ExerciseReport, PerTargetStat } from '../types';
import type { NoteNamesConfig, NoteNamesPrompt, NoteNamesAnswer } from './types';
import { CHROMATIC, noteAt, pitchOf, type Note } from '../../music/notes';
import type { Pos } from '../../music/caged';

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const key = (p: Pos) => `${p.string}-${p.fret}`;

// Typed note name → Note. Accepts sharps and flats ("C#", "db", "C♯", "E♭"),
// including enharmonic spellings like "Cb" or "E#". null when unparseable.
export function parseNoteName(text: string): Note | null {
  const m = text.trim().match(/^([a-g])\s*(#|♯|b|♭|sharp|flat)?$/i);
  if (!m) return null;
  const base = CHROMATIC.indexOf(m[1].toUpperCase() as Note);
  const acc = (m[2] ?? '').toLowerCase();
  const shift = acc === '#' || acc === '♯' || acc === 'sharp' ? 1 : acc ? -1 : 0;
  return CHROMATIC[(base + shift + 12) % 12];
}

export class NoteNamesExercise implements Exercise<NoteNamesConfig, NoteNamesPrompt, NoteNamesAnswer, ExerciseReport> {
  private config!: NoteNamesConfig;
  private prompt: NoteNamesPrompt | null = null;
  private prevKey = '';
  private startedAt = 0;
  private attempts: Array<{ pos: Pos; correct: boolean; elapsedMs: number }> = [];

  start(config: NoteNamesConfig): void {
    if (config.strings.length === 0) throw new Error('NoteNamesExercise needs at least one string');
    this.config = config;
    this.prompt = null;
    this.prevKey = '';
    this.attempts = [];
  }

  getNextPrompt(): NoteNamesPrompt {
    const { strings, maxFret, noteVariant: variant } = this.config;
    let highlight: Pos;
    // Don't repeat the previous fret (or, for 'play', the previous note+string).
    for (let tries = 0; ; tries++) {
      highlight = { string: pick(strings), fret: Math.floor(Math.random() * (maxFret + 1)) };
      const k = variant === 'name' ? key(highlight) : `${highlight.string}-${noteAt(highlight.string, highlight.fret)}`;
      if (k !== this.prevKey || tries > 50) { this.prevKey = k; break; }
    }
    const note = noteAt(highlight.string, highlight.fret);
    const accepted: Pos[] = [];
    for (let f = 0; f <= maxFret; f++) if (noteAt(highlight.string, f) === note) accepted.push({ string: highlight.string, fret: f });
    this.prompt = { variant, string: highlight.string, note, highlight, accepted };
    this.startedAt = Date.now();
    return this.prompt;
  }

  submitAnswer(answer: NoteNamesAnswer): AnswerResult<NoteNamesAnswer> {
    const p = this.prompt;
    if (!p) throw new Error('submitAnswer called before getNextPrompt');
    let hit: Pos | undefined;
    let correct: boolean;
    if ('note' in answer) correct = answer.note === p.note;
    else if ('midi' in answer) {
      // ponytail: exact pitch on the string's frets; the mic can't tell which
      // string rang, so the same pitch on another string also counts.
      hit = p.accepted.find(a => pitchOf(a.string, a.fret) === answer.midi);
      correct = !!hit;
    } else {
      hit = p.accepted.find(a => key(a) === key(answer));
      correct = !!hit;
    }
    const elapsedMs = Date.now() - this.startedAt;
    this.attempts.push({ pos: p.variant === 'name' ? p.highlight : hit ?? p.accepted[0], correct, elapsedMs });
    this.prompt = null;
    const correctAnswers: NoteNamesAnswer[] = p.variant === 'name' ? [{ note: p.note }] : p.accepted;
    return { correct, correctAnswers, elapsedMs, promptComplete: true };
  }

  notifyResumed(pauseDurationMs: number): void {
    this.startedAt += pauseDurationMs;
  }

  // Same shape as Root Notes so the report shows a per-position heatmap.
  getReport(): ExerciseReport {
    const total = this.attempts.length;
    const correct = this.attempts.filter(a => a.correct).length;
    const byPos = new Map<string, PerTargetStat & { totalTime: number }>();
    for (const a of this.attempts) {
      const e = byPos.get(key(a.pos)) ?? { position: { ...a.pos }, timesAsked: 0, correctCount: 0, avgTimeMs: 0, totalTime: 0 };
      e.timesAsked += 1;
      if (a.correct) e.correctCount += 1;
      e.totalTime += a.elapsedMs;
      byPos.set(key(a.pos), e);
    }
    return {
      totalPrompts: total,
      correctCount: correct,
      incorrectCount: total - correct,
      accuracy: total === 0 ? 0 : correct / total,
      avgTimeMs: total === 0 ? 0 : this.attempts.reduce((n, a) => n + a.elapsedMs, 0) / total,
      perTargetStats: [...byPos.values()].map(({ totalTime, ...s }) => ({ ...s, avgTimeMs: totalTime / s.timesAsked })),
      attempts: this.attempts.map(({ correct, elapsedMs }) => ({ correct, elapsedMs }))
    };
  }
}
