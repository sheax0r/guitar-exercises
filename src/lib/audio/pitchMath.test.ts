import { describe, it, expect } from 'vitest';
import { hzToMidi, OnsetDetector } from './pitchMath';

describe('hzToMidi', () => {
  it('maps reference pitches to MIDI', () => {
    expect(hzToMidi(440)).toBe(69);   // A4
    expect(hzToMidi(880)).toBe(81);   // A5
    expect(hzToMidi(82.41)).toBe(40); // low E (E2)
    expect(hzToMidi(329.63)).toBe(64); // high E (E4)
  });
});

describe('OnsetDetector', () => {
  it('accepts a stable high-clarity note once per onset', () => {
    const d = new OnsetDetector({ clarityThreshold: 0.9, stableFrames: 3 });
    expect(d.push(60, 0.95)).toBeNull(); // frame 1
    expect(d.push(60, 0.95)).toBeNull(); // frame 2
    expect(d.push(60, 0.95)).toBe(60);   // frame 3 -> onset
    expect(d.push(60, 0.95)).toBeNull(); // still held, no re-accept
    expect(d.push(60, 0.95)).toBeNull();
  });

  it('re-accepts the same note after a silence gap', () => {
    const d = new OnsetDetector({ clarityThreshold: 0.9, stableFrames: 3 });
    d.push(60, 0.95); d.push(60, 0.95);
    expect(d.push(60, 0.95)).toBe(60);
    d.push(null, 0.1);   // silence gap
    expect(d.push(60, 0.95)).toBeNull();
    expect(d.push(60, 0.95)).toBeNull();
    expect(d.push(60, 0.95)).toBe(60);   // accepted again
  });

  it('rejects low-clarity readings', () => {
    const d = new OnsetDetector();
    expect(d.push(60, 0.3)).toBeNull();
    expect(d.push(60, 0.3)).toBeNull();
    expect(d.push(60, 0.3)).toBeNull();
  });

  it('switches cleanly to a different note without a silence gap', () => {
    const d = new OnsetDetector({ clarityThreshold: 0.9, stableFrames: 3 });
    d.push(60, 0.95); d.push(60, 0.95);
    expect(d.push(60, 0.95)).toBe(60);
    // A new, different stable note is a new onset even with no silence between.
    d.push(62, 0.95); d.push(62, 0.95);
    expect(d.push(62, 0.95)).toBe(62);
  });
});
