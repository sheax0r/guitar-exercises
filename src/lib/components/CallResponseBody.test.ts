import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CallResponseBody from './CallResponseBody.svelte';
import type { CallResponseConfig } from '../exercise/callresponse/types';

vi.mock('../audio/pluck', () => ({ midiAsPos: (m: number) => ({ string: 6, fret: m - 40 }), playPluck: () => {} }));
vi.mock('../audio/sequence', () => ({ playSequence: () => () => {} }));

const config: CallResponseConfig = {
  exercise: 'call-response', lengths: [3], degrees: ['1', '3', '5'], motion: 'leaps', showStart: true,
  rhythm: false, keyRoot: 'C', drone: false, inputMode: 'click', micSensitivity: 0.5, micDeviceId: null,
  maxFret: 12, durationSec: 300, continuous: false, showFretNumbers: true, playSound: false
};

describe('CallResponseBody — click', () => {
  it('judges a wrong and a right response', async () => {
    // Every draw picks the first option: the phrase is C E C (1 3 1).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(CallResponseBody, { props: { config, onComplete: () => {}, onAbort: () => {} } });
    const hit = (s: number, f: number) => container.querySelector(`[data-role="hit"][data-string="${s}"][data-fret="${f}"]`)!;
    expect(container.textContent).toContain('starts on C (1)');
    await fireEvent.click(hit(1, 1)); // F: wrong first note
    expect(container.querySelector('.bad')!.textContent).toBe('✗ 1');
    expect(container.textContent).toContain('It was C – E – C (1 3 1)');
    await fireEvent.click(container.querySelector('.slots')!); // continue
    await fireEvent.click(hit(5, 3)); // C
    await fireEvent.click(hit(1, 0)); // E, an octave up: still right
    await fireEvent.click(hit(2, 1)); // C
    expect(container.querySelector('.ok')!.textContent).toBe('✓ 1');
    expect(container.querySelectorAll('.slot.ok')).toHaveLength(3);
  });
});
