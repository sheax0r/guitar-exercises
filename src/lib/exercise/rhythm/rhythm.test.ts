import { describe, it, expect } from 'vitest';
import { barSlots, drawBars, gridTargets, scoreRhythm, PATTERNS } from './rhythm';

describe('barSlots / drawBars', () => {
  it('places the targets in beats within a 4/4 bar', () => {
    expect(barSlots('one')).toEqual([0]);
    expect(barSlots('beats')).toEqual([0, 1, 2, 3]);
    expect(barSlots('ands')).toEqual([0.5, 1.5, 2.5, 3.5]);
  });

  it('draws one pattern per bar for the pattern target, the fixed slots otherwise', () => {
    expect(drawBars('beats', 3, () => 0)).toEqual([[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]);
    const bars = drawBars('pattern', 4, () => 0.99);
    expect(bars).toHaveLength(4);
    bars.forEach(b => expect(b).toEqual(PATTERNS[PATTERNS.length - 1].slots));
  });
});

describe('gridTargets', () => {
  it('turns bar slots into times and kinds from the run start', () => {
    // 120 bpm: 0.5 s per beat, 2 s per bar.
    const t = gridTargets([[0, 1.5], [3]], 10, 120, 0);
    expect(t).toEqual([
      { t: 10, kind: 'one', bar: 0 },
      { t: 10.75, kind: 'and', bar: 0 },
      { t: 13.5, kind: 'beat', bar: 1 }
    ]);
  });

  it('numbers bars from firstBar (a resumed run)', () => {
    expect(gridTargets([[0]], 0, 120, 5)[0].bar).toBe(5);
  });
});

describe('scoreRhythm', () => {
  const targets = [
    { t: 1, kind: 'one' as const, bar: 0 },
    { t: 1.5, kind: 'beat' as const, bar: 0 },
    { t: 2, kind: 'beat' as const, bar: 0 },
    { t: 2.5, kind: 'and' as const, bar: 0 }
  ];

  it('scores signed error in ms; within tolerance is a hit, else a miss', () => {
    const r = scoreRhythm(targets, [1.02, 1.49, 2.2], 50);
    expect(r.results.map(x => x.errorMs)).toEqual([20, -10, null, null]);
    expect(r.correctCount).toBe(2);
    // 2.2 is 200 ms from both neighbours: an extra hit, and both are misses.
    expect(r.extras).toBe(1);
    expect(r.incorrectCount).toBe(2 + 1);
    expect(r.accuracy).toBeCloseTo(2 / 5);
    expect(r.meanAbsMs).toBe(15);
    expect(r.biasMs).toBe(5);
  });

  it('keeps the closest of two onsets on one target; the other is an extra', () => {
    const r = scoreRhythm(targets.slice(0, 1), [0.97, 1.01], 50);
    expect(r.results[0].errorMs).toBe(10);
    expect(r.extras).toBe(1);
  });

  it('gives hit rates per target kind', () => {
    const r = scoreRhythm(targets, [1, 1.5, 2.53], 50);
    expect(r.perKind).toEqual([
      { kind: 'one', targets: 1, hits: 1, meanAbsMs: 0 },
      { kind: 'beat', targets: 2, hits: 1, meanAbsMs: 0 },
      { kind: 'and', targets: 1, hits: 1, meanAbsMs: 30 }
    ]);
  });

  it('handles nothing played', () => {
    const r = scoreRhythm(targets, [], 50);
    expect(r.correctCount).toBe(0);
    expect(r.accuracy).toBe(0);
    expect(r.meanAbsMs).toBeNull();
    expect(r.biasMs).toBeNull();
  });
});
