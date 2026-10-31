import { describe, it, expect, vi } from 'vitest';
import { playSequence } from './sequence';
import { playPluck } from './pluck';

vi.mock('./pluck', () => ({ playPluck: vi.fn() }));

describe('playSequence', () => {
  it('is a no-op for an empty list', () => {
    expect(() => playSequence([])).not.toThrow();
  });

  it('does not throw with no AudioContext (headless)', () => {
    expect(() =>
      playSequence([{ string: 6, fret: 0 }, { string: 5, fret: 2 }], 10)
    ).not.toThrow();
  });

  it('returns a canceller that is safe to call', () => {
    const cancel = playSequence([{ string: 6, fret: 0 }, { string: 5, fret: 2 }], 1000);
    expect(typeof cancel).toBe('function');
    expect(() => cancel()).not.toThrow();
    expect(() => cancel()).not.toThrow(); // idempotent
  });
});

describe('playSequence with per-note gaps', () => {
  it('plays note i+1 gapMs[i] after note i', () => {
    vi.useFakeTimers();
    vi.mocked(playPluck).mockClear();
    playSequence([{ string: 6, fret: 0 }, { string: 6, fret: 2 }, { string: 6, fret: 4 }], [100, 300]);
    expect(playPluck).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    expect(playPluck).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(299);
    expect(playPluck).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(playPluck).toHaveBeenLastCalledWith(6, 4);
    vi.useRealTimers();
  });
});
