import { describe, it, expect } from 'vitest';
import { TakeCapture, TAKE_SEC, judgeStrum, strumPitches } from './strum';

const SR = 8000;
const block = (amp: number, n = 800) => new Float32Array(n).fill(amp);

describe('TakeCapture', () => {
  it('waits for quiet after arming, then records on the first loud block', () => {
    const cap = new TakeCapture(SR, 0.5);
    cap.arm();
    expect(cap.push(block(0.5))).toBeNull(); // still ringing from before: ignored
    expect(cap.recording).toBe(false);
    cap.push(block(0));
    cap.push(block(0));
    cap.push(block(0.5));
    expect(cap.recording).toBe(true);
    let take: Float32Array | null = null;
    for (let i = 0; i < 40 && !take; i++) take = cap.push(block(0.2));
    expect(take).not.toBeNull();
    expect(take!.length).toBeGreaterThanOrEqual(TAKE_SEC * SR);
    expect(take![0]).toBe(0); // pre-roll kept
    expect(cap.recording).toBe(false);
    expect(cap.push(block(0))).toBeNull(); // disarmed after one take
    expect(cap.push(block(0.5))).toBeNull();
    expect(cap.recording).toBe(false);
  });

  it('trigger() starts at once; unarmed blocks never record', () => {
    const cap = new TakeCapture(SR);
    cap.push(block(0));
    cap.push(block(0.5));
    cap.trigger();
    expect(cap.recording).toBe(false);
    cap.arm();
    cap.trigger();
    expect(cap.recording).toBe(true);
  });
});

describe('strumPitches', () => {
  it('drops faint and out-of-range notes, sorts ascending', () => {
    const n = (m: number, amp: number) => ({ midiFloat: m, start: 0, dur: 1, amp });
    expect(strumPitches([n(64.2, 0.8), n(48, 0.9), n(55, 0.1), n(20, 0.9), n(52, 0.5)])).toEqual([48, 52, 64]);
    expect(strumPitches([])).toEqual([]);
  });
});

describe('judgeStrum', () => {
  const C = [0, 4, 7];
  it('passes on the exact pitch-class set, any voicing or doubling', () => {
    expect(judgeStrum([48, 52, 55, 60, 64], C).correct).toBe(true);
  });
  it('reports missing and extra pitch classes', () => {
    const v = judgeStrum([48, 52, 62], C);
    expect(v.correct).toBe(false);
    expect(v.missing).toEqual([7]);
    expect(v.extra).toEqual([2]);
  });
  it('optionally requires the bass', () => {
    expect(judgeStrum([52, 55, 60], C, 0)).toMatchObject({ correct: false, bassOk: false, bassPc: 4 });
    expect(judgeStrum([48, 52, 55], C, 0)).toMatchObject({ correct: true, bassOk: true });
    expect(judgeStrum([], C, 0).correct).toBe(false);
  });
});
