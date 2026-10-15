import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StartScreen from './StartScreen.svelte';
import type { AnyConfig } from '../exercise/config';

describe('StartScreen — exercise selector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function exerciseSelect(container: HTMLElement): HTMLSelectElement {
    return container.querySelector('#exercise') as HTMLSelectElement;
  }

  it('offers both exercises and is not disabled', () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    const sel = exerciseSelect(container);
    expect(sel.disabled).toBe(false);
    const values = Array.from(sel.options).map(o => o.value);
    expect(values).toContain('root-notes');
    expect(values).toContain('random-roots');
  });

  it('hides the root-note picker when random-roots is selected', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    expect(container.querySelector('#note')).not.toBeNull();
    await fireEvent.change(exerciseSelect(container), { target: { value: 'random-roots' } });
    expect(container.querySelector('#note')).toBeNull();
  });

  it('emits exercise=random-roots in the started config', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'random-roots' } });
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart.mock.calls[0][0].exercise).toBe('random-roots');
  });

  it('defaults to root-notes', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    expect(onStart.mock.calls[0][0].exercise).toBe('root-notes');
  });

  it('offers the play-shape exercise', () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    const values = Array.from(exerciseSelect(container).options).map(o => o.value);
    expect(values).toContain('play-shape');
  });

  it('shows mode chips and shape controls when play-shape is selected', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'play-shape' } });
    // 7 mode chips + 2 shape chips are present among the chip buttons.
    const chipText = Array.from(container.querySelectorAll('.chip')).map(c => c.textContent?.trim());
    expect(chipText).toContain('Ionian');
    expect(chipText).toContain('Locrian');
    expect(chipText).toContain('One octave');
    expect(chipText).toContain('Position box');
    // Root-note picker is hidden for modes exercises.
    expect(container.querySelector('#note')).toBeNull();
  });

  it('emits a play-shape config with the enabled modes', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'play-shape' } });
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    const config = onStart.mock.calls[0][0];
    expect(config.exercise).toBe('play-shape');
    if (config.exercise === 'play-shape') {
      expect(config.enabledModes.length).toBe(7);
    }
  });

  it('disables Start when every mode is toggled off', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'play-shape' } });
    const modeChips = Array.from(container.querySelectorAll('.chip'))
      .filter(c => ['Ionian','Dorian','Phrygian','Lydian','Mixolydian','Aeolian','Locrian']
        .includes(c.textContent?.trim() ?? ''));
    for (const chip of modeChips) {
      if (chip.classList.contains('chip-active')) await fireEvent.click(chip);
    }
    expect((container.querySelector('.start-button') as HTMLButtonElement).disabled).toBe(true);
  });
});
