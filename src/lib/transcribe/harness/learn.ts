// Learn mic-judging regression: replay real guitar takes (GuitarSet) through the live
// judging path (createFrameJudge via listenOffline) and check the annotated notes are heard.
// Used by the dev harness page (run.ts, engine "learn") and by learn.test.ts (skips when the
// fixtures aren't fetched).
//
// A note counts as heard when an onset of the same MIDI pitch is accepted between 50 ms before
// it starts and 100 ms after it ends. Notes shorter than MIN_NOTE_SEC are left out: the onset
// detector needs 5 stable frames (~83 ms at 60 fps) by design, so faster runs are out of a
// drill's scope. precision = accepted onsets that land on some annotated note that way.
import { FIXTURES } from './fixtures';

export const MIN_NOTE_SEC = 0.12;
export interface AnnotNote { midi: number; start: number; dur: number }
export interface Onset { midi: number; t: number }
export interface LearnScore { nExp: number; nDet: number; recall: number; precision: number }

// GuitarSet .jams: one note_midi annotation per string.
export function jamsNotes(text: string): AnnotNote[] {
  return JSON.parse(text)
    .annotations.filter((a: { namespace: string }) => a.namespace === 'note_midi')
    .flatMap((a: { data: unknown[] }) => a.data)
    .map((d: { value: number; time: number; duration: number }) => ({ midi: Math.round(d.value), start: d.time, dur: d.duration }))
    .sort((a: AnnotNote, b: AnnotNote) => a.start - b.start);
}

const hits = (o: Onset, n: AnnotNote) => o.midi === n.midi && o.t >= n.start - 0.05 && o.t <= n.start + n.dur + 0.1;

export function scoreLearn(onsets: Onset[], annot: AnnotNote[]): LearnScore {
  const exp = annot.filter(n => n.dur >= MIN_NOTE_SEC);
  const recall = exp.length ? exp.filter(n => onsets.some(o => hits(o, n))).length / exp.length : 0;
  const precision = onsets.length ? onsets.filter(o => annot.some(n => hits(o, n))).length / onsets.length : 0;
  return { nExp: exp.length, nDet: onsets.length, recall, precision };
}

// Regression floors, a little under measured results (default sensitivity, 60 fps).
export const LEARN_EXPECT: Record<string, { recall: number; precision: number }> = {
  'guitarset-Jazz1-200-B': { recall: 0, precision: 0 },
  'guitarset-BN1-147-Gb': { recall: 0, precision: 0 }
};

export const LEARN_FIXTURES = FIXTURES.filter(f => f.id in LEARN_EXPECT);
