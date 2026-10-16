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
    inputMode: 'mic',
    micSensitivity: 0.5,
    micDeviceId: null
  };
}

function boxMicConfig(): PlayShapeConfig {
  return { ...micConfig(), shapeVariant: 'box', octaveJudge: 'fixed', boxSpan: 4 };
}

describe('PlayShapeBody mic input', () => {
  it('box + mic advances the prompt on a detected in-window note', async () => {
    captured = null;
    const { container } = render(SessionScreen, {
      props: { config: boxMicConfig(), onComplete: () => {}, onAbort: () => {} }
    });
    expect(container.querySelector('.mic')).toBeTruthy();
    await Promise.resolve();
    await Promise.resolve();
    expect(captured).not.toBeNull();
    const progress = () => container.querySelector('.progress')!.textContent!;
    for (let midi = 40; midi <= 90 && progress().startsWith('0 /'); midi++) {
      captured!(midi);
      await Promise.resolve();
    }
    expect(progress().startsWith('0 /')).toBe(false); // claimed at least one box note
  });

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

  it('ignores stray detected notes while awaiting advance (does not eat the next note)', async () => {
    captured = null;
    const { container } = render(SessionScreen, {
      props: { config: micConfig(), onComplete: () => {}, onAbort: () => {} }
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(captured).not.toBeNull();

    const progress = () => container.querySelector('.progress')!.textContent!;
    const total = parseInt(progress().split('/')[1].trim(), 10);
    // Drive the whole octave run to completion by sweeping candidate pitches.
    for (let round = 0; round < total + 3 && !progress().startsWith(`${total} /`); round++) {
      for (let midi = 40; midi <= 90 && !progress().startsWith(`${total} /`); midi++) {
        captured!(midi);
        await Promise.resolve();
      }
    }
    expect(progress().startsWith(`${total} /`)).toBe(true);
    // Completed: the advance hint is shown.
    expect(container.querySelector('.continue-hint')).toBeTruthy();

    // A stray detected note must NOT start scoring a new prompt (no eaten note,
    // no noise-driven advance). Progress stays at the completed count.
    captured!(60);
    await Promise.resolve();
    expect(progress().startsWith(`${total} /`)).toBe(true);
  });
});
