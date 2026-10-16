import { describe, it, expect } from 'vitest';
import { hzToMidi, rms, inGuitarRange, rmsFloorForSensitivity, DEFAULT_MIC_SENSITIVITY, OnsetDetector } from './pitchMath';

describe('rmsFloorForSensitivity', () => {
  it('higher sensitivity lowers the floor; bounds and clamping hold', () => {
    expect(rmsFloorForSensitivity(0)).toBeCloseTo(0.04, 5);   // chill
    expect(rmsFloorForSensitivity(1)).toBeCloseTo(0.004, 5);  // sensitive
    expect(rmsFloorForSensitivity(0.5)).toBeGreaterThan(rmsFloorForSensitivity(0.9));
    // out-of-range clamps
    expect(rmsFloorForSensitivity(-1)).toBeCloseTo(0.04, 5);
    expect(rmsFloorForSensitivity(5)).toBeCloseTo(0.004, 5);
  });
  it('has a sane default', () => {
    expect(DEFAULT_MIC_SENSITIVITY).toBeGreaterThan(0);
    expect(DEFAULT_MIC_SENSITIVITY).toBeLessThan(1);
  });
});

describe('rms loudness gate', () => {
  it('is ~0 for silence and higher for a loud signal', () => {
    expect(rms(new Float32Array(1024))).toBe(0);
    const quiet = Float32Array.from({ length: 1024 }, () => 0.005);
    const loud = Float32Array.from({ length: 1024 }, (_, i) => Math.sin(i) * 0.5);
    expect(rms(quiet)).toBeLessThan(0.015);  // idle hum below the floor
    expect(rms(loud)).toBeGreaterThan(0.015); // a played note above it
  });
});

describe('inGuitarRange', () => {
  it('accepts guitar pitches and rejects spurious sub/ultra readings', () => {
    expect(inGuitarRange(40)).toBe(true);  // low E
    expect(inGuitarRange(64)).toBe(true);  // high E open
    expect(inGuitarRange(10)).toBe(false); // sub-harmonic junk
    expect(inGuitarRange(120)).toBe(false);
  });
});

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
