import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CallResponseBody from './CallResponseBody.svelte';
import type { CallResponseConfig } from '../exercise/callresponse/types';
import type { LickDrillConfig } from '../exercise/lick/types';

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

describe('CallResponseBody — Lick Drill', () => {
  it('asks for the lick from another note and string, and judges in order', async () => {
    const lick: LickDrillConfig = {
      exercise: 'lick-drill', lick: [57, 60, 62, 64], lickName: 'Penta', target: 'D', startString: 6,
      inputMode: 'click', micSensitivity: 0.5, micDeviceId: null, maxFret: 12, durationSec: 300, continuous: false,
      showFretNumbers: true, playSound: false
    };
    const { container } = render(CallResponseBody, { props: { config: lick, onComplete: () => {}, onAbort: () => {} } });
    const hit = (s: number, f: number) => container.querySelector(`[data-role="hit"][data-string="${s}"][data-fret="${f}"]`)!;
    expect(container.textContent).toMatch(/play it starting on D\s+on\s+the 6th string/);
    await fireEvent.click(hit(5, 5)); // D, but on the 5th string
    expect(container.querySelector('.bad')!.textContent).toBe('✗ 1');
    expect(container.textContent).toContain('It was D – F – G – A');
    await fireEvent.click(container.querySelector('.slots')!); // continue
    for (const [s, f] of [[6, 10], [4, 3], [5, 10], [5, 12]]) await fireEvent.click(hit(s, f));
    expect(container.querySelector('.ok')!.textContent).toBe('✓ 1');
  });
});
