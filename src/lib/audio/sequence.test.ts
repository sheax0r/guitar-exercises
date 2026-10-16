import { describe, it, expect } from 'vitest';
import { playSequence } from './sequence';

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
