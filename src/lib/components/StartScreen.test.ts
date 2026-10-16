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

  it('offers the modes exercises', () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    const values = Array.from(exerciseSelect(container).options).map(o => o.value);
    expect(values).toContain('play-shape');
    expect(values).toContain('identify-mode');
  });

  it('shows mode chips but no shape controls for identify-mode', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'identify-mode' } });
    const chipText = Array.from(container.querySelectorAll('.chip')).map(c => c.textContent?.trim());
    expect(chipText).toContain('Dorian');
    // Shape / judging controls belong to play-shape only.
    expect(chipText).not.toContain('One octave');
    expect(chipText).not.toContain('Position box');
  });

  it('emits an identify-mode config', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'identify-mode' } });
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    expect(onStart.mock.calls[0][0].exercise).toBe('identify-mode');
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

  it('disables Start when the box span is cleared (prevents an infeasible config)', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'play-shape' } });
    // Switch to the box shape, which reveals the span number input.
    const boxChip = Array.from(container.querySelectorAll('.chip'))
      .find(c => c.textContent?.trim() === 'Position box') as HTMLButtonElement;
    await fireEvent.click(boxChip);
    const span = container.querySelector('#span') as HTMLInputElement;
    expect(span).toBeTruthy();
    await fireEvent.input(span, { target: { value: '' } });
    expect((container.querySelector('.start-button') as HTMLButtonElement).disabled).toBe(true);
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

describe('StartScreen — modes sound/ear controls', () => {
  beforeEach(() => localStorage.clear());

  function exerciseSelect(container: HTMLElement): HTMLSelectElement {
    return container.querySelector('#exercise') as HTMLSelectElement;
  }
  function chipByText(container: HTMLElement, text: string): HTMLButtonElement {
    return Array.from(container.querySelectorAll('.chip'))
      .find(c => c.textContent?.trim() === text) as HTMLButtonElement;
  }

  it('play-shape emits the new sound/ear defaults', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'play-shape' } });
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    const cfg = onStart.mock.calls[0][0];
    expect(cfg.exercise).toBe('play-shape');
    if (cfg.exercise === 'play-shape') {
      expect(cfg.drone).toBe(false);
      expect(cfg.highlightCharacteristic).toBe(false);
      expect(cfg.fixedRootNote).toBe(null);
      expect(cfg.inputMode).toBe('click');
    }
  });

  it('mic chip: disabled for octave+fixed, enabled for octave+pitch and for box', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'play-shape' } });
    // Default octave + fixed judge: mic disabled (can't verify position by pitch).
    expect(chipByText(container, 'Play (mic)').disabled).toBe(true);
    // octave + "Any position (by pitch)": enabled.
    await fireEvent.click(chipByText(container, 'Any position (by pitch)'));
    expect(chipByText(container, 'Play (mic)').disabled).toBe(false);
    // Position box: also enabled (notes matched by pitch).
    await fireEvent.click(chipByText(container, 'Position box'));
    expect(chipByText(container, 'Play (mic)').disabled).toBe(false);
  });

  it('emits inputMode=mic only when octave+pitch is active', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'play-shape' } });
    await fireEvent.click(chipByText(container, 'Any position (by pitch)'));
    await fireEvent.click(chipByText(container, 'Play (mic)'));
    // Drone is a checkbox, not a chip; toggle it directly.
    const droneBox = Array.from(container.querySelectorAll('label'))
      .find(l => l.textContent?.includes('Drone the root'))!
      .querySelector('input') as HTMLInputElement;
    if (!droneBox.checked) await fireEvent.click(droneBox);
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'play-shape') {
      expect(cfg.inputMode).toBe('mic');
      expect(cfg.drone).toBe(true);
    }
  });

  it('identify-mode emits promptMode=audio when "Hear the scale" is chosen', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'identify-mode' } });
    await fireEvent.click(chipByText(container, 'Hear the scale'));
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'identify-mode') {
      expect(cfg.promptMode).toBe('audio');
    }
  });

  it('shows mic sensitivity + input-source controls when mic is selected', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'play-shape' } });
    await fireEvent.click(chipByText(container, 'Any position (by pitch)'));
    await fireEvent.click(chipByText(container, 'Play (mic)'));
    // The shared MicSettings controls are present.
    expect(container.querySelector('input[aria-label="Mic sensitivity"]')).toBeTruthy();
    expect(container.querySelector('select[aria-label="Input source"]')).toBeTruthy();
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'play-shape') {
      expect(typeof cfg.micSensitivity).toBe('number');
      expect(cfg.micDeviceId).toBe(null);
    }
  });

  it('fixed root emits the chosen note', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'identify-mode' } });
    await fireEvent.click(chipByText(container, 'Fixed'));
    const sel = container.querySelector('select[aria-label="Fixed root note"]') as HTMLSelectElement;
    await fireEvent.change(sel, { target: { value: 'G' } });
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'identify-mode') {
      expect(cfg.fixedRootNote).toBe('G');
    }
  });
});
