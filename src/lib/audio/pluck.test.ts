import { describe, it, expect, vi, afterEach } from 'vitest';
import { playPluck, playInterval } from './pluck';

describe('playPluck', () => {
  it('does not throw when AudioContext is unavailable (jsdom)', () => {
    expect(() => playPluck(1, 5)).not.toThrow();
    expect(() => playPluck(6, 0)).not.toThrow();
  });
});

describe('playInterval', () => {
  afterEach(() => vi.useRealTimers());

  it('plays the second note after a delay without throwing', () => {
    vi.useFakeTimers();
    expect(() =>
      playInterval({ string: 6, fret: 0 }, { string: 4, fret: 2 })
    ).not.toThrow();
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});
