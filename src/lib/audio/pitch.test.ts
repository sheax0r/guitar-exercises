import { describe, it, expect } from 'vitest';
import { startPitchListener } from './pitch';

describe('startPitchListener', () => {
  it('rejects cleanly when no microphone is available (jsdom)', async () => {
    // jsdom has no navigator.mediaDevices.getUserMedia, so this must reject
    // rather than throw synchronously or hang.
    await expect(startPitchListener(() => {})).rejects.toThrow(/microphone|audio/i);
  });
});
