import { describe, it, expect } from 'vitest';
import { tunerReading } from './tuner';

describe('tunerReading', () => {
  it('names the nearest note with its cents offset', () => {
    expect(tunerReading(440, 0.95)).toEqual({ note: 'A4', cents: 0 });
    expect(tunerReading(82.4069 * 2 ** (10 / 1200), 0.95)).toEqual({ note: 'E2', cents: 10 });
    expect(tunerReading(440 * 2 ** (-30 / 1200), 0.95)).toEqual({ note: 'A4', cents: -30 });
  });
  it('rejects unclear or out-of-range frames', () => {
    expect(tunerReading(440, 0.5)).toBeNull();
    expect(tunerReading(50, 0.99)).toBeNull();
    expect(tunerReading(2000, 0.99, 200, 4000)).toEqual({ note: 'B6', cents: 21 });
  });
});
