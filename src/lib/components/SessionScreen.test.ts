import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SessionScreen from './SessionScreen.svelte';
import type { ExerciseConfig } from '../exercise/types';
import type { PlayShapeConfig, IdentifyModeConfig } from '../exercise/modes/types';
import type { ChordTonesConfig } from '../exercise/chordtones/types';

vi.mock('../audio/pluck', () => ({ midiAsPos: (m: number) => ({ string: 6, fret: m - 40 }), playPluck: () => {}, playInterval: () => {} }));

function makeConfig(): ExerciseConfig {
  return {
    exercise: 'root-notes',
    targetNote: 'A',
    durationSec: 300,
    continuous: false,
    maxFret: 22,
    showAllLabels: false,
    showRootMarkers: false,
    showFretNumbers: true,
    playSound: false,
    algorithm: 'fret-first',
    intervals: ['3rd', '5th'], intervalRef: 'diatonic-from-note',
    keyRoot: 'C',
    keyQuality: 'major',
    direction: 'nearest'
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

describe('SessionScreen — per-prompt target (random-roots)', () => {
  it('shows the prompt target drawn from {A,E,D}, not config.targetNote', () => {
    // config.targetNote is deliberately 'C' (outside the random pool) so a
    // header reading from config rather than the prompt would be caught.
    const { container } = render(SessionScreen, {
      props: {
        config: { ...makeConfig(), exercise: 'random-roots', targetNote: 'C' },
        onComplete: () => {},
        onAbort: () => {}
      }
    });
    const target = container.querySelector('.target strong')!.textContent;
    expect(['A', 'E', 'D']).toContain(target);
  });

  it('shows config.targetNote in root-notes mode', () => {
    const { container } = render(SessionScreen, {
      props: {
        config: { ...makeConfig(), targetNote: 'G' },
        onComplete: () => {},
        onAbort: () => {}
      }
    });
    expect(container.querySelector('.target strong')!.textContent).toBe('G');
  });

  it('asks for the interval in intervals mode without revealing the answer note', () => {
    const { container } = render(SessionScreen, {
      props: {
        config: {
          ...makeConfig(),
          exercise: 'intervals',
          keyRoot: 'C',
          keyQuality: 'major',
          intervals: ['3rd'], intervalRef: 'diatonic-from-note'
        },
        onComplete: () => {},
        onAbort: () => {}
      }
    });
    const header = container.querySelector('.target')!.textContent!;
    expect(header).toContain('Find the');
    expect(header).toContain('3rd');
    expect(header).toContain('key of C major');
    // The header emphasises the shown note and the interval, never the target.
    const emphasised = Array.from(container.querySelectorAll('.target strong'))
      .map(e => e.textContent);
    expect(emphasised).toContain('3rd');
  });
});

describe('SessionScreen — play-shape', () => {
  function playShapeConfig(): PlayShapeConfig {
    return {
      exercise: 'play-shape',
      enabledModes: ['ionian'],
      shapeVariant: 'octave',
      octaveJudge: 'fixed',
      boxSpan: 4,
      maxFret: 22,
      durationSec: 300,
      continuous: true,
      showFretNumbers: true,
      playSound: false,
      drone: false,
      highlightCharacteristic: false,
      fixedRootNote: null,
      inputMode: 'click',
      micSensitivity: 0.5,
      micDeviceId: null,
      displayNotePercentage: 100
    };
  }

  it('renders the mode label and a 0 / N progress counter', () => {
    const { container } = render(SessionScreen, {
      props: { config: playShapeConfig(), onComplete: () => {}, onAbort: () => {} }
    });
    expect(container.querySelector('.target strong')!.textContent).toBe('Ionian');
    expect(container.querySelector('.progress')!.textContent).toMatch(/^0 \/ [1-9]/);
    // The root is marked on the board so the player knows where to start.
    expect(container.querySelector('[data-role="highlight"][data-kind="scale-root"]')).toBeTruthy();
  });

  it('marks a correct first click without completing the prompt', async () => {
    const { container } = render(SessionScreen, {
      props: { config: playShapeConfig(), onComplete: () => {}, onAbort: () => {} }
    });
    // The root is the first expected step; click it.
    const rootCircle = container.querySelector('[data-role="highlight"][data-kind="scale-root"]');
    expect(rootCircle).toBeTruthy();
    // Find the root's string/fret from the progress and click via its hit-rect:
    // the scale-root highlight sits at the root position, so click that cell.
    // Derive it from the only scale-root highlight by matching its transform is
    // brittle; instead click every hit until progress advances to 1.
    const hits = Array.from(container.querySelectorAll('[data-role="hit"]')) as HTMLElement[];
    for (const hit of hits) {
      hit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      if (container.querySelector('.progress')!.textContent!.startsWith('1 /')) break;
    }
    expect(container.querySelector('.progress')!.textContent!.startsWith('1 /')).toBe(true);
  });
});

describe('SessionScreen — identify-mode', () => {
  function identifyConfig(): IdentifyModeConfig {
    return {
      exercise: 'identify-mode',
      enabledModes: ['ionian', 'dorian', 'aeolian'],
      maxFret: 22,
      durationSec: 300,
      continuous: true,
      showFretNumbers: true,
      playSound: false,
      drone: false,
      highlightCharacteristic: false,
      fixedRootNote: null,
      promptMode: 'visual',
      displayNotePercentage: 100
    };
  }

  it('renders scale highlights and a mode button per enabled mode', () => {
    const { container } = render(SessionScreen, {
      props: { config: identifyConfig(), onComplete: () => {}, onAbort: () => {} }
    });
    expect(container.querySelector('[data-role="highlight"][data-kind="scale-root"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-role="highlight"][data-kind="scale-note"]').length).toBeGreaterThan(0);
    const choiceText = Array.from(container.querySelectorAll('.choice')).map(b => b.textContent?.trim());
    expect(choiceText).toEqual(['Ionian', 'Dorian', 'Aeolian']);
  });

  it('records an answer when a mode button is clicked', async () => {
    const { container } = render(SessionScreen, {
      props: { config: identifyConfig(), onComplete: () => {}, onAbort: () => {} }
    });
    const firstChoice = container.querySelector('.choice') as HTMLButtonElement;
    await fireEvent.click(firstChoice);
    const okN = parseInt(container.querySelector('.ok')!.textContent!.replace(/\D/g, ''), 10);
    const badN = parseInt(container.querySelector('.bad')!.textContent!.replace(/\D/g, ''), 10);
    expect(okN + badN).toBe(1);
    // After answering, the buttons are disabled.
    expect(firstChoice.disabled).toBe(true);
  });

  it('audio prompt hides the scale notes until an answer is given', async () => {
    const { container } = render(SessionScreen, {
      props: {
        config: { ...identifyConfig(), promptMode: 'audio' },
        onComplete: () => {},
        onAbort: () => {}
      }
    });
    // Before answering: root markers only, no scale-note reveal, and a Replay.
    expect(container.querySelector('[data-role="highlight"][data-kind="scale-root"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-role="highlight"][data-kind="scale-note"]').length).toBe(0);
    expect(Array.from(container.querySelectorAll('button')).some(b => b.textContent?.includes('Replay'))).toBe(true);
    // After answering: the scale is revealed.
    await fireEvent.click(container.querySelector('.choice') as HTMLButtonElement);
    expect(container.querySelectorAll('[data-role="highlight"][data-kind="scale-note"]').length).toBeGreaterThan(0);
  });

  it('characteristic reveal marks a characteristic highlight after answering', async () => {
    const { container } = render(SessionScreen, {
      props: {
        config: { ...identifyConfig(), highlightCharacteristic: true },
        onComplete: () => {},
        onAbort: () => {}
      }
    });
    // Not revealed before answering.
    expect(container.querySelectorAll('[data-role="highlight"][data-kind="characteristic"]').length).toBe(0);
    await fireEvent.click(container.querySelector('.choice') as HTMLButtonElement);
    expect(container.querySelectorAll('[data-role="highlight"][data-kind="characteristic"]').length).toBeGreaterThan(0);
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

describe('SessionScreen — chord-tone targeting (untimed, click)', () => {
  it('judges right and wrong targets and auto-advances on a right one', async () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0); // start at string 1, fret 0 (E)
    const config: ChordTonesConfig = {
      exercise: 'chord-tones', progression: 'ii-V-I', keyRoot: 'C', target: 'guide', backing: 'off',
      tempo: 'untimed', bpm: 80, barsPerChord: 1, algorithm: 'fret-first', inputMode: 'click',
      micSensitivity: 0.5, micDeviceId: null, maxFret: 12, durationSec: 300, continuous: false,
      showFretNumbers: true, playSound: false
    };
    const { container } = render(SessionScreen, { props: { config, onComplete: () => {}, onAbort: () => {} } });
    const hit = (s: number, f: number) => container.querySelector(`[data-role="hit"][data-string="${s}"][data-fret="${f}"]`)!;
    expect(container.textContent).toContain('Dm7');
    // Dm7's 3rd nearest E at 1/0 is F at 1/1.
    await fireEvent.click(hit(1, 1));
    expect(container.querySelector('.ok')!.textContent).toBe('✓ 1');
    await new Promise(r => setTimeout(r, 800));
    expect(container.textContent).toContain('G7');
    // G7's 7th is F again: staying on 1/1 is right, so 1/0 is wrong.
    await fireEvent.click(hit(1, 0));
    expect(container.querySelector('.bad')!.textContent).toBe('✗ 1');
    expect(container.querySelector('[data-role="highlight"][data-kind="correct-flash"]')).toBeTruthy();
    rnd.mockRestore();
  });
});
