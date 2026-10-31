import { describe, it, expect } from 'vitest';
import { AmpOnsetDetector } from './onsets';

const SR = 48000;

// Decaying 220 Hz plucks starting at the given times (s), over `dur` seconds.
function plucks(times: number[], dur: number, amp = 0.3, hz = 220, decay = 6): Float32Array {
  const out = new Float32Array(Math.round(dur * SR));
  for (const t0 of times) {
    for (let i = Math.round(t0 * SR); i < out.length; i++) {
      const t = i / SR - t0;
      out[i] += amp * Math.exp(-t * decay) * Math.sin(2 * Math.PI * hz * t);
    }
  }
  return out;
}

// Feeds `data` the way the live listener does: the newest 2048-sample analyser
// window every `hop` samples, stamped with the time of its last sample.
function feed(data: Float32Array, hop = 800, floor = 0.01): number[] {
  const det = new AmpOnsetDetector(SR, floor), out: number[] = [];
  for (let end = 2048; end <= data.length; end += hop) out.push(...det.push(data.subarray(end - 2048, end), end / SR));
  return out;
}

describe('AmpOnsetDetector', () => {
  it('finds each pluck once, within a few ms, including over a ringing note', () => {
    const times = [0.2, 0.7, 1.1, 1.35];
    const found = feed(plucks(times, 1.8));
    expect(found).toHaveLength(times.length);
    found.forEach((t, i) => expect(Math.abs(t - times[i])).toBeLessThan(0.008));
  });

  it('hears a sustained low E once (its envelope ripple is not an attack)', () => {
    expect(feed(plucks([0.1], 2, 0.3, 82.4, 1))).toHaveLength(1);
  });

  it('ignores signal under the loudness floor', () => {
    expect(feed(plucks([0.2, 0.6], 1, 0.005))).toEqual([]);
  });

  it('does not double-count overlapping windows or a gap in frames', () => {
    // Big hop = frames that skip samples; still one onset per pluck.
    expect(feed(plucks([0.3, 0.9], 1.4), 3000)).toHaveLength(2);
  });
});
