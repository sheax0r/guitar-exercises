import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StartScreen from './StartScreen.svelte';
import type { RootNotesConfig } from '../exercise/rootNotes/types';

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
    const onStart = vi.fn<(c: RootNotesConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.change(exerciseSelect(container), { target: { value: 'random-roots' } });
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart.mock.calls[0][0].exercise).toBe('random-roots');
  });

  it('defaults to root-notes', async () => {
    const onStart = vi.fn<(c: RootNotesConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(container.querySelector('.start-button') as HTMLButtonElement);
    expect(onStart.mock.calls[0][0].exercise).toBe('root-notes');
  });
});
