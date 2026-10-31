// Pure rhythm-drill logic: the beat grid, and scoring onsets against it.
import type { GridTarget, KindStat, RhythmReport, RhythmTarget, TargetKind } from './types';

// Short one-bar patterns for the 'pattern' target, in beats (0.5 = the "and" of 1).
export const PATTERNS: Array<{ name: string; slots: number[] }> = [
  { name: 'Charleston', slots: [0, 1.5] },
  { name: 'Backbeat', slots: [1, 3] },
  { name: 'Tresillo', slots: [0, 1.5, 3] },
  { name: 'Push', slots: [0, 1, 2, 3.5] }
];

export function barSlots(target: Exclude<RhythmTarget, 'pattern'>): number[] {
  return target === 'one' ? [0] : target === 'beats' ? [0, 1, 2, 3] : [0.5, 1.5, 2.5, 3.5];
}

// The slots of every bar of the session (patterns are drawn per bar).
export function drawBars(target: RhythmTarget, bars: number, rng: () => number = Math.random): number[][] {
  return Array.from({ length: bars }, () =>
    target === 'pattern' ? PATTERNS[Math.floor(rng() * PATTERNS.length)].slots : barSlots(target));
}

export const slotKind = (beat: number): TargetKind => beat === 0 ? 'one' : Number.isInteger(beat) ? 'beat' : 'and';

// Bars of slots -> grid times. `start` is beat 1 of the first bar (seconds); 4/4.
export function gridTargets(bars: number[][], start: number, bpm: number, firstBar: number): GridTarget[] {
  const beat = 60 / bpm;
  return bars.flatMap((slots, i) =>
    slots.map(s => ({ t: start + (i * 4 + s) * beat, kind: slotKind(s), bar: firstBar + i })));
}

const mean = (xs: number[]): number | null => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const round = (x: number | null): number | null => x === null ? null : Math.round(x);

// Each onset goes to its nearest target. Within tolerance it's a candidate for that
// target, and the closest candidate is the hit; every other onset is an extra hit.
// Accuracy = hits / (targets + extras), so misses and extra hits both count against it.
export function scoreRhythm(targets: GridTarget[], onsets: number[], toleranceMs: number, calibMs = 0): RhythmReport {
  const best: Array<number | null> = targets.map(() => null); // signed error, ms
  for (const o of onsets) {
    let k = -1, d = Infinity;
    targets.forEach((tg, i) => { const e = Math.abs(o - tg.t); if (e < d) { d = e; k = i; } });
    if (k < 0 || d * 1000 > toleranceMs + 1e-6) continue;
    const err = (o - targets[k].t) * 1000;
    if (best[k] === null || Math.abs(err) < Math.abs(best[k]!)) best[k] = err;
  }
  const results = targets.map((tg, i) => ({ kind: tg.kind, bar: tg.bar, errorMs: round(best[i]) }));
  const hitErrs = best.filter((e): e is number => e !== null);
  const hits = hitErrs.length;
  const extras = onsets.length - hits;
  const perKind: KindStat[] = (['one', 'beat', 'and'] as const).flatMap(kind => {
    const rs = results.filter(r => r.kind === kind);
    if (!rs.length) return [];
    const errs = rs.flatMap(r => r.errorMs === null ? [] : [Math.abs(r.errorMs)]);
    return [{ kind, targets: rs.length, hits: errs.length, meanAbsMs: round(mean(errs)) }];
  });
  const denom = targets.length + extras;
  return {
    totalPrompts: targets.length,
    correctCount: hits,
    incorrectCount: targets.length - hits + extras,
    accuracy: denom ? hits / denom : 0,
    extras,
    meanAbsMs: round(mean(hitErrs.map(Math.abs))),
    biasMs: round(mean(hitErrs)),
    perKind,
    results,
    toleranceMs,
    calibMs
  };
}
