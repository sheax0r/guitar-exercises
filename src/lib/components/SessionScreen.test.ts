import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SessionScreen from './SessionScreen.svelte';
import type { RootNotesConfig } from '../exercise/rootNotes/types';

vi.mock('../audio/pluck', () => ({ playPluck: () => {} }));

function makeConfig(): RootNotesConfig {
  return {
    targetNote: 'A',
    durationSec: 300,
    continuous: false,
    maxFret: 22,
    showAllLabels: false,
    showRootMarkers: false,
    showFretNumbers: true,
    playSound: false,
    algorithm: 'fret-first'
  };
}

describe('SessionScreen — answer feedback gate', () => {
  it('after clicking a fret, the prompt does NOT immediately advance (waits for a second action)', async () => {
    const { container } = render(SessionScreen, {
      props: {
        config: makeConfig(),
        onComplete: () => {},
        onAbort: () => {}
      }
    });

    expect(container.querySelector('.ok')!.textContent).toBe('✓ 0');
    expect(container.querySelector('.bad')!.textContent).toBe('✗ 0');

    const cell = container.querySelector('[data-role="hit"][data-string="1"][data-fret="5"]')!;
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    const okN = parseInt(container.querySelector('.ok')!.textContent!.replace(/\D/g, ''), 10);
    const badN = parseInt(container.querySelector('.bad')!.textContent!.replace(/\D/g, ''), 10);
    expect(okN + badN).toBe(1);

    const hint = container.querySelector('.continue-hint');
    expect(hint).toBeTruthy();
    expect(hint!.textContent).toContain('continue');
  });

  // Direct regression check: even if Svelte's effect happens to register the
  // window click listener while the rect's onclick is still on the stack
  // (which the user is observing in their browser), the window handler must
  // not fire for a click whose target is a fretboard hit-rect — otherwise
  // the same click both submits and advances, leaving no visible feedback.
  it('a click on a hit-rect that ALSO reaches the window handler must not advance the prompt', async () => {
    const { container } = render(SessionScreen, {
      props: {
        config: makeConfig(),
        onComplete: () => {},
        onAbort: () => {}
      }
    });

    const cell = container.querySelector('[data-role="hit"][data-string="1"][data-fret="5"]')!;
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // Drain the microtask so the window listener is registered.
    await Promise.resolve();

    // Now simulate the offending case: the *same* click target reaches the
    // window listener while awaitingAdvance is true. Dispatching another
    // click on the rect mimics the bubble-with-active-listener scenario.
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    // The second click was on a hit-rect, so handleSelect's awaitingAdvance
    // branch runs and advances. That's expected. The point of this test is
    // that the window handler must not ALSO advance — i.e. correctCount/
    // incorrectCount stays at 1, not jumps to 2 or more.
    const okN = parseInt(container.querySelector('.ok')!.textContent!.replace(/\D/g, ''), 10);
    const badN = parseInt(container.querySelector('.bad')!.textContent!.replace(/\D/g, ''), 10);
    expect(okN + badN).toBe(1);
  });
});

describe('SessionScreen — fret-number toggle', () => {
  function fretNumberCheckbox(container: HTMLElement): HTMLInputElement {
    const label = Array.from(container.querySelectorAll('label.toggle'))
      .find(l => l.textContent?.includes('Fret numbers'))!;
    return label.querySelector('input[type="checkbox"]') as HTMLInputElement;
  }

  it('shows fret numbers by default and hides them when the toggle is unchecked', async () => {
    const { container } = render(SessionScreen, {
      props: { config: makeConfig(), onComplete: () => {}, onAbort: () => {} }
    });

    expect(container.querySelectorAll('[data-role="fret-number"]').length).toBeGreaterThan(0);

    const checkbox = fretNumberCheckbox(container);
    expect(checkbox.checked).toBe(true);
    await fireEvent.click(checkbox);

    expect(container.querySelectorAll('[data-role="fret-number"]')).toHaveLength(0);
  });

  it('starts hidden when config.showFretNumbers is false', () => {
    const { container } = render(SessionScreen, {
      props: { config: { ...makeConfig(), showFretNumbers: false }, onComplete: () => {}, onAbort: () => {} }
    });
    expect(container.querySelectorAll('[data-role="fret-number"]')).toHaveLength(0);
    expect(fretNumberCheckbox(container).checked).toBe(false);
  });

  it('does not pause the session when fret numbers are toggled off', async () => {
    const { container } = render(SessionScreen, {
      props: { config: makeConfig(), onComplete: () => {}, onAbort: () => {} }
    });
    await fireEvent.click(fretNumberCheckbox(container));
    // Toggling fret numbers is purely visual — unlike "Show roots" it must not
    // bring up the Paused overlay.
    expect(container.querySelector('.paused-overlay')).toBeNull();
  });
});
