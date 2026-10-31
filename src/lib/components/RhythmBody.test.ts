import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import RhythmBody from './RhythmBody.svelte';
import type { RhythmConfig, RhythmReport } from '../exercise/rhythm/types';
import type { MetronomeOptions } from '../audio/metronome';

// The AudioContext clock sits at 0, so the count-in starts at 0.2 s and, at 120 bpm,
// bar 1 starts at 2.2 s (beats every 0.5 s).
const ctx = { state: 'running', currentTime: 0, resume: () => Promise.resolve() };
vi.mock('../audio/context', () => ({ getAudioContext: () => ctx }));
let metronome: MetronomeOptions | null = null;
vi.mock('../audio/metronome', () => ({ startMetronome: (_ctx: unknown, o: MetronomeOptions) => { metronome = o; return () => {}; } }));
vi.mock('../audio/calibration', () => ({ loadCalibMs: () => -100, hasCalib: () => true }));
vi.mock('../audio/pitch', () => ({ listAudioInputs: () => Promise.resolve([]) }));
let onset: ((t: number) => void) | null = null;
let tapAt = 0;
vi.mock('../audio/onsets', () => ({
  startOnsetListener: (cb: (t: number) => void) => { onset = cb; return Promise.resolve({ stop() {}, setSensitivity() {} }); },
  eventToCtxTime: () => tapAt
}));

const config: RhythmConfig = {
  exercise: 'rhythm', target: 'beats', bpm: 120, bars: 2, toleranceMs: 50,
  inputMode: 'mic', micSensitivity: 0.5, micDeviceId: null
};
// Bar 1's score settles tolerance + latency + 100 ms after bar 2's downbeat.
const SETTLE = 50 + 100 + 100 + 30;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const beat = async (b: number) => { metronome!.onBeat!(b, 0); await wait(2); await tick(); };
// The mic hears a note 100 ms after it's played (the calibration offset is -100 ms).
const play = (t: number) => onset!(t + 0.1);

describe('RhythmBody', () => {
  beforeEach(() => { metronome = null; onset = null; ctx.currentTime = 0; });

  it('scores each beat in ms after the latency offset, with misses and extra hits', async () => {
    const onComplete = vi.fn();
    const { container } = render(RhythmBody, { props: { config, onComplete, onAbort: () => {} } });
    await tick(); await wait(0);
    expect(container.textContent).toContain('Count-in');
    play(1.0); // during the count-in: ignored
    for (const b of [0, 1, 2, 3, 4]) await beat(b);
    expect(container.textContent).toContain('Bar 1 / 2');
    play(2.22); play(2.69); /* beat 3 missed */ play(3.45); play(3.73);
    for (const b of [5, 6, 7, 8]) await beat(b);
    await wait(SETTLE); await tick();
    const fb = container.querySelector('[aria-label="Last bar"]')!.textContent!;
    expect(fb).toContain('1 +20 ms');
    expect(fb).toContain('2 -10 ms');
    expect(fb).toContain('3 miss');
    expect(fb).toContain('4 +30 ms');
    expect(fb).toContain('1 extra');
    expect(container.querySelector('.ok')!.textContent).toBe('✓ 3');
    expect(container.querySelector('.bad')!.textContent).toBe('✗ 2');

    for (const t of [4.2, 4.7, 5.2, 5.7]) play(t);
    for (const b of [9, 10, 11, 12]) await beat(b);
    await wait(SETTLE);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const r: RhythmReport = onComplete.mock.calls[0][0];
    expect(r.totalPrompts).toBe(8);
    expect(r.correctCount).toBe(7);
    expect(r.extras).toBe(1);
    expect(r.calibMs).toBe(-100);
    expect(r.perKind).toEqual([
      { kind: 'one', targets: 2, hits: 2, meanAbsMs: 10 },
      { kind: 'beat', targets: 6, hits: 5, meanAbsMs: 8 }
    ]);
  });

  it('drops the unfinished bar on pause and replays it after a new count-in', async () => {
    const onComplete = vi.fn();
    const { getByText } = render(RhythmBody, { props: { config, onComplete, onAbort: () => {} } });
    await tick(); await wait(0);
    for (const b of [0, 1, 2, 3, 4]) await beat(b);
    for (const t of [2.2, 2.7, 3.2, 3.7]) play(t);
    for (const b of [5, 6, 7, 8]) await beat(b);
    await wait(SETTLE);
    play(4.2); // bar 2, then pause: thrown away
    const first = metronome;
    await fireEvent.click(getByText('Pause'));
    ctx.currentTime = 10;
    await fireEvent.click(getByText('Resume'));
    expect(metronome).not.toBe(first); // a new count-in; bar 2 now starts at 12.2 s
    for (const b of [0, 1, 2, 3, 4]) await beat(b);
    for (const t of [12.2, 12.7, 13.2]) play(t);
    for (const b of [5, 6, 7, 8]) await beat(b);
    await wait(SETTLE);
    const r: RhythmReport = onComplete.mock.calls[0][0];
    expect(r.correctCount).toBe(7);
    expect(r.extras).toBe(0);
    expect(r.results.filter(x => x.errorMs === null).map(x => x.bar)).toEqual([1]);
  });

  it('takes key taps without the mic, with no latency offset', async () => {
    const onComplete = vi.fn();
    render(RhythmBody, { props: { config: { ...config, inputMode: 'click', bars: 1, target: 'one' }, onComplete, onAbort: () => {} } });
    await tick();
    for (const b of [0, 1, 2, 3, 4]) await beat(b);
    tapAt = 2.18;
    await fireEvent.keyDown(window, { key: 'j' });
    for (const b of [5, 6, 7, 8]) await beat(b);
    await wait(50 + 100 + 30);
    const r: RhythmReport = onComplete.mock.calls[0][0];
    expect(r.results).toEqual([{ kind: 'one', bar: 0, errorMs: -20 }]);
    expect(r.calibMs).toBe(0);
  });
});
