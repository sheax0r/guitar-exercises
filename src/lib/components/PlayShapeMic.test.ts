import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

// Capture the onNote callback the body registers, so the test can simulate
// detected pitches without a real microphone.
let captured: ((midi: number) => void) | null = null;
vi.mock('../audio/pitch', () => ({
  startPitchListener: (onNote: (midi: number) => void) => {
    captured = onNote;
    return Promise.resolve({ stop() {} });
  }
}));

import SessionScreen from './SessionScreen.svelte';
import type { PlayShapeConfig } from '../exercise/modes/types';

function micConfig(): PlayShapeConfig {
  return {
    exercise: 'play-shape',
    enabledModes: ['ionian'],
    shapeVariant: 'octave',
    octaveJudge: 'pitch',
    boxSpan: 4,
    maxFret: 22,
    durationSec: 300,
    continuous: true,
    showFretNumbers: true,
    playSound: false,
    drone: false,
    highlightCharacteristic: false,
    fixedRootNote: null,
    inputMode: 'mic'
  };
}

describe('PlayShapeBody mic input', () => {
  it('shows the mic indicator and advances the prompt on a detected pitch', async () => {
    captured = null;
    const { container } = render(SessionScreen, {
      props: { config: micConfig(), onComplete: () => {}, onAbort: () => {} }
    });
    // Mic indicator present.
    expect(container.querySelector('.mic')).toBeTruthy();
    // The registered callback is captured after the mount effect runs.
    await Promise.resolve();
    await Promise.resolve();
    expect(captured).not.toBeNull();

    // Feed candidate pitches (standard-tuning range) until the octave/pitch
    // judge accepts the expected next step and progress advances to 1.
    const progress = () => container.querySelector('.progress')!.textContent!;
    for (let midi = 40; midi <= 88 && !progress().startsWith('1 /'); midi++) {
      captured!(midi);
      await Promise.resolve();
    }
    expect(progress().startsWith('1 /')).toBe(true);
  });
});
