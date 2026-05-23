import { describe, it, expect } from 'vitest';
import { playPluck } from './pluck';

describe('playPluck', () => {
  it('does not throw when AudioContext is unavailable (jsdom)', () => {
    expect(() => playPluck(1, 5)).not.toThrow();
    expect(() => playPluck(6, 0)).not.toThrow();
  });
});
