import { describe, it, expect, vi, afterEach } from 'vitest';
import { beatSeconds, startMetronome } from './metronome';
import { CALIB_KEY, loadCalibMs, saveCalibMs } from './calibration';

// Minimal fake AudioContext: records each oscillator's start time and frequency.
function fakeCtx() {
  const clicks: Array<{ t: number; hz: number }> = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const ctx = {
    currentTime: 0,
    destination: {},
    createGain: () => ({ gain: param(), connect: (n: unknown) => n }),
    createOscillator: () => {
      const o = { frequency: param(), type: '', connect: (n: unknown) => n, start: (t: number) => clicks.push({ t, hz: o.frequency.value }), stop() {} };
      return o;
    }
  };
  return { ctx: ctx as unknown as AudioContext, clicks };
}

afterEach(() => vi.useRealTimers());

describe('metronome', () => {
  it('beat length follows the beat value', () => {
    expect(beatSeconds(120, 4)).toBe(0.5);
    expect(beatSeconds(120, 8)).toBe(0.25);
  });

  it('schedules accented downbeats ahead of time and stops', () => {
    vi.useFakeTimers();
    const { ctx, clicks } = fakeCtx();
    const beats: number[] = [];
    const stop = startMetronome(ctx, { bpm: 240, num: 3, den: 4, startAt: 0, clickBeat: b => b !== 1, volume: () => 1, onBeat: b => beats.push(b) });
    for (let t = 0; t < 1; t += 0.025) {
      (ctx as unknown as { currentTime: number }).currentTime = t;
      vi.advanceTimersByTime(25);
    }
    stop();
    const n = beats.length;
    vi.advanceTimersByTime(1000);
    expect(beats.length).toBe(n);
    expect(beats.slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(clicks.map(c => c.t).slice(0, 3)).toEqual([0, 0.5, 0.75]); // beat 1 muted
    expect(clicks.map(c => c.hz).slice(0, 3)).toEqual([1600, 1000, 1600]); // beat 3 = next bar's downbeat
  });
});

describe('calibration storage', () => {
  it("reads and writes Whistler's key", () => {
    localStorage.setItem(CALIB_KEY, '-42');
    expect(CALIB_KEY).toBe('whistler.calib');
    expect(loadCalibMs()).toBe(-42);
    saveCalibMs(17);
    expect(localStorage.getItem('whistler.calib')).toBe('17');
    localStorage.setItem(CALIB_KEY, 'junk');
    expect(loadCalibMs()).toBe(0);
  });
});
