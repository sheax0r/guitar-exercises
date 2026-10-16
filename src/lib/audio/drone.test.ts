import { describe, it, expect } from 'vitest';
import { startDrone, midiForDrone } from './drone';

describe('drone', () => {
  it('midiForDrone places the note in octave 3', () => {
    expect(midiForDrone('C')).toBe(48); // C3
    expect(midiForDrone('E')).toBe(52); // E3
    expect(midiForDrone('A')).toBe(57); // A3
  });

  it('startDrone returns a handle whose stop() is safe with no AudioContext', () => {
    // jsdom provides window but no AudioContext -> getAudioContext() is null.
    const handle = startDrone(52);
    expect(() => handle.stop()).not.toThrow();
    expect(() => handle.stop()).not.toThrow(); // idempotent
  });
});
