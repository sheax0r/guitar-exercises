import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StartScreen from './StartScreen.svelte';
import type { AnyConfig } from '../exercise/config';
import { sessionHash } from '../routing/hash';

const PREFS_KEY = 'guitar-exercises.prefs.v1';

function card(container: HTMLElement, id: string): HTMLButtonElement {
  return container.querySelector(`button[data-exercise="${id}"]`) as HTMLButtonElement;
}
function chipByText(container: HTMLElement, text: string, group?: string): HTMLButtonElement {
  const root = group ? container.querySelector(`[aria-label="${group}"]`)! : container;
  return Array.from(root.querySelectorAll('.chip'))
    .find(c => c.textContent?.trim() === text) as HTMLButtonElement;
}
function startButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('.start-button') as HTMLButtonElement;
}
function storedPrefs() {
  return JSON.parse(localStorage.getItem(PREFS_KEY)!);
}

describe('StartScreen — exercise selector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers nine exercise cards and no select', () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    expect(container.querySelector('#exercise')).toBeNull();
    const ids = Array.from(container.querySelectorAll('button.card')).map(c => c.getAttribute('data-exercise'));
    expect(ids).toEqual(['root-notes', 'intervals', 'degrees', 'play-shape', 'identify-mode', 'caged', 'chord-tones', 'call-response', 'rhythm']);
  });

  it('hides the target-note picker for modes exercises', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    expect(container.querySelector('[aria-label="Target note"]')).not.toBeNull();
    await fireEvent.click(card(container, 'play-shape'));
    expect(container.querySelector('[aria-label="Target note"]')).toBeNull();
  });

  it('emits exercise=random-roots when the A/E/D target is picked', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(chipByText(container, 'A/E/D', 'Target note'));
    await fireEvent.click(startButton(container));
    expect(onStart).toHaveBeenCalledOnce();
    expect(onStart.mock.calls[0][0].exercise).toBe('random-roots');
  });

  it('emits the picked root-notes target', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(chipByText(container, 'G', 'Target note'));
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    expect(cfg.exercise).toBe('root-notes');
    if (cfg.exercise === 'root-notes') expect(cfg.targetNote).toBe('G');
  });

  it('defaults to root-notes', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    expect(card(container, 'root-notes').getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(startButton(container));
    expect(onStart.mock.calls[0][0].exercise).toBe('root-notes');
  });

  it('legacy prefs exercise=random-roots selects Root Notes with A/E/D', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ exercise: 'random-roots' }));
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    expect(card(container, 'root-notes').getAttribute('aria-pressed')).toBe('true');
    expect(chipByText(container, 'A/E/D', 'Target note').classList.contains('chip-active')).toBe(true);
    await fireEvent.click(startButton(container));
    expect(onStart.mock.calls[0][0].exercise).toBe('random-roots');
  });

  it('shows mode chips but no shape controls for identify-mode', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(card(container, 'identify-mode'));
    const chipText = Array.from(container.querySelectorAll('.chip')).map(c => c.textContent?.trim());
    expect(chipText).toContain('Dorian');
    // Shape / judging controls belong to play-shape only.
    expect(chipText).not.toContain('One octave');
    expect(chipText).not.toContain('Position box');
  });

  it('emits an identify-mode config', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'identify-mode'));
    await fireEvent.click(startButton(container));
    expect(onStart.mock.calls[0][0].exercise).toBe('identify-mode');
  });

  it('shows mode chips and shape controls when play-shape is selected', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(card(container, 'play-shape'));
    const chipText = Array.from(container.querySelectorAll('.chip')).map(c => c.textContent?.trim());
    expect(chipText).toContain('Ionian');
    expect(chipText).toContain('Locrian');
    expect(chipText).toContain('One octave');
    expect(chipText).toContain('Position box');
  });

  it('emits a play-shape config with the enabled modes', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'play-shape'));
    await fireEvent.click(startButton(container));
    const config = onStart.mock.calls[0][0];
    expect(config.exercise).toBe('play-shape');
    if (config.exercise === 'play-shape') {
      expect(config.enabledModes.length).toBe(7);
    }
  });

  it('disables Start when the box span is cleared (prevents an infeasible config)', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(card(container, 'play-shape'));
    // Switch to the box shape, which reveals the span number input.
    await fireEvent.click(chipByText(container, 'Position box'));
    const span = container.querySelector('#span') as HTMLInputElement;
    expect(span).toBeTruthy();
    await fireEvent.input(span, { target: { value: '' } });
    expect(startButton(container).disabled).toBe(true);
  });

  it('emits an intervals config with chosen intervals and the from-root reference', async () => {
    const onStart = vi.fn();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'intervals'));
    await fireEvent.click(chipByText(container, '7th', 'Intervals'));
    await fireEvent.click(chipByText(container, '3rd', 'Intervals'));
    await fireEvent.click(chipByText(container, 'Key root, chromatic', 'Measured from'));
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    expect(cfg.intervals).toEqual(['5th', '7th']);
    expect(cfg.intervalRef).toBe('from-root');
  });

  it('emits a Root Notes find-all config', async () => {
    const onStart = vi.fn();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(chipByText(container, 'Find them all', 'Drill'));
    await fireEvent.click(chipByText(container, '5-fret window', 'Where'));
    await fireEvent.click(startButton(container));
    expect(onStart.mock.calls[0][0]).toMatchObject({ exercise: 'root-notes', rootVariant: 'find-all', findAllWindow: 'window' });
  });

  it('emits a degrees config', async () => {
    const onStart = vi.fn();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'degrees'));
    await fireEvent.click(chipByText(container, 'Find the degree', 'Drill'));
    await fireEvent.click(startButton(container));
    expect(onStart.mock.calls[0][0]).toMatchObject({ exercise: 'degrees', degreeVariant: 'find', keyRoot: 'C' });
  });

  it('emits a caged play-shape config with other scales and mic', async () => {
    const onStart = vi.fn();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'play-shape'));
    await fireEvent.click(chipByText(container, 'Minor pentatonic', 'Other scales'));
    await fireEvent.click(chipByText(container, 'CAGED position'));
    await fireEvent.click(chipByText(container, 'Play (mic)'));
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    expect(cfg.shapeVariant).toBe('caged');
    expect(cfg.inputMode).toBe('mic');
    expect(cfg.enabledModes).toContain('minor-pentatonic');
    expect(cfg.enabledModes).toHaveLength(8);
  });

  it('disables Start when every mode is toggled off', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(card(container, 'play-shape'));
    const modeChips = Array.from(container.querySelectorAll('[aria-label="Modes"] .chip'));
    expect(modeChips.length).toBe(7);
    for (const chip of modeChips) {
      if (chip.classList.contains('chip-active')) await fireEvent.click(chip);
    }
    expect(startButton(container).disabled).toBe(true);
  });
});

describe('StartScreen — modes sound/ear controls', () => {
  beforeEach(() => localStorage.clear());

  it('play-shape emits the new sound/ear defaults', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'play-shape'));
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    expect(cfg.exercise).toBe('play-shape');
    if (cfg.exercise === 'play-shape') {
      expect(cfg.drone).toBe(false);
      expect(cfg.highlightCharacteristic).toBe(false);
      expect(cfg.fixedRootNote).toBe(null);
      expect(cfg.inputMode).toBe('click');
    }
  });

  it('mic chip is enabled under octave+fixed and switches judging to by-pitch', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'play-shape'));
    expect(chipByText(container, 'Play (mic)').disabled).toBe(false);
    await fireEvent.click(chipByText(container, 'Play (mic)'));
    expect(chipByText(container, 'Any position (by pitch)').classList.contains('chip-active')).toBe(true);
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    expect(cfg.exercise).toBe('play-shape');
    if (cfg.exercise === 'play-shape') {
      expect(cfg.inputMode).toBe('mic');
      expect(cfg.octaveJudge).toBe('pitch');
    }
  });

  it('choosing Fixed fingering after mic reverts input to click', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'play-shape'));
    await fireEvent.click(chipByText(container, 'Play (mic)'));
    await fireEvent.click(chipByText(container, 'Fixed fingering'));
    expect(chipByText(container, 'Click the notes').classList.contains('chip-active')).toBe(true);
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'play-shape') {
      expect(cfg.inputMode).toBe('click');
      expect(cfg.octaveJudge).toBe('fixed');
    }
  });

  it('emits inputMode=mic with drone when octave+pitch is active', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'play-shape'));
    await fireEvent.click(chipByText(container, 'Any position (by pitch)'));
    await fireEvent.click(chipByText(container, 'Play (mic)'));
    // Drone is a checkbox inside More options.
    const droneBox = Array.from(container.querySelectorAll('label'))
      .find(l => l.textContent?.includes('Drone the root'))!
      .querySelector('input') as HTMLInputElement;
    if (!droneBox.checked) await fireEvent.click(droneBox);
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'play-shape') {
      expect(cfg.inputMode).toBe('mic');
      expect(cfg.drone).toBe(true);
    }
  });

  it('identify-mode emits promptMode=audio when "Hear the scale" is chosen', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'identify-mode'));
    await fireEvent.click(chipByText(container, 'Hear the scale'));
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'identify-mode') {
      expect(cfg.promptMode).toBe('audio');
    }
  });

  it('shows mic sensitivity + input-source controls when mic is selected', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'play-shape'));
    await fireEvent.click(chipByText(container, 'Any position (by pitch)'));
    await fireEvent.click(chipByText(container, 'Play (mic)'));
    expect(container.querySelector('input[aria-label="Mic sensitivity"]')).toBeTruthy();
    expect(container.querySelector('select[aria-label="Input source"]')).toBeTruthy();
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'play-shape') {
      expect(typeof cfg.micSensitivity).toBe('number');
      expect(cfg.micDeviceId).toBe(null);
    }
  });

  it('fixed root emits the chosen note', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'identify-mode'));
    await fireEvent.click(chipByText(container, 'G', 'Root'));
    await fireEvent.click(startButton(container));
    const cfg = onStart.mock.calls[0][0];
    if (cfg.exercise === 'identify-mode') {
      expect(cfg.fixedRootNote).toBe('G');
    }
  });
});

describe('StartScreen — layout, summary and recents', () => {
  beforeEach(() => localStorage.clear());

  it('"More options" is a closed details holding the Play notes checkbox', () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    const more = container.querySelector('details.more') as HTMLDetailsElement;
    expect(more).toBeTruthy();
    expect(more.open).toBe(false);
    expect(Array.from(more.querySelectorAll('label')).some(l => l.textContent?.includes('Play notes'))).toBe(true);
  });

  it('sticky summary describes the default config', () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    expect(container.querySelector('.start-bar .summary')?.textContent).toBe('Root Notes · A · 5m · 24 frets');
  });

  it('Start records a recent session that starts the same config again', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const first = render(StartScreen, { props: { onStart } });
    await fireEvent.click(startButton(first.container));
    expect(storedPrefs().recentSessions).toHaveLength(1);
    first.unmount();

    const { container } = render(StartScreen, { props: { onStart } });
    const recent = container.querySelectorAll('.recent');
    expect(recent).toHaveLength(1);
    expect(recent[0].textContent).toBe('Root Notes · A · 5m · 24 frets');
    await fireEvent.click(recent[0]);
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart.mock.calls[1][0]).toEqual(onStart.mock.calls[0][0]);
    expect(storedPrefs().recentSessions).toHaveLength(1);
  });

  it('skips unparseable stored recents', () => {
    const valid = sessionHash({
      exercise: 'identify-mode', enabledModes: ['dorian'], maxFret: 12, durationSec: 60, continuous: false,
      showFretNumbers: true, playSound: true, drone: false, highlightCharacteristic: false,
      fixedRootNote: null, promptMode: 'visual', displayNotePercentage: 100
    });
    localStorage.setItem(PREFS_KEY, JSON.stringify({ recentSessions: ['garbage', '#/session?ex=nope', valid] }));
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    expect(container.querySelectorAll('.recent')).toHaveLength(1);
  });

  it('Start still works and prunes junk when stored recents are corrupt', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ recentSessions: 'abc' }));
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(startButton(container));
    expect(onStart).toHaveBeenCalledOnce();
    expect(storedPrefs().recentSessions).toHaveLength(1);
  });

  it('a recent that reads the same as a new start is replaced, not duplicated', async () => {
    const first = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(startButton(first.container));
    first.unmount();

    // Change an intervals-only setting, which alters the hash but not Root Notes' summary.
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(card(container, 'intervals'));
    await fireEvent.click(chipByText(container, '5th', 'Intervals'));
    await fireEvent.click(card(container, 'root-notes'));
    await fireEvent.click(startButton(container));
    expect(storedPrefs().recentSessions).toHaveLength(1);
  });

  it('switching to A/E/D remembers the fixed target picked this visit', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(chipByText(container, 'C', 'Target note'));
    await fireEvent.click(chipByText(container, 'A/E/D', 'Target note'));
    await fireEvent.click(startButton(container));
    expect(storedPrefs().targetNote).toBe('C');
  });

  it('duration chips expose the selection via aria-pressed', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(chipByText(container, 'Continuous', 'Duration'));
    expect(chipByText(container, 'Continuous', 'Duration').getAttribute('aria-pressed')).toBe('true');
    expect(chipByText(container, '5m', 'Duration').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('StartScreen — CAGED', () => {
  beforeEach(() => localStorage.clear());

  it('emits a caged config, persists its prefs, and needs a shape and a quality', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'caged'));
    await fireEvent.click(chipByText(container, 'Name the shape', 'Drill'));
    await fireEvent.click(chipByText(container, 'G', 'Shapes'));
    await fireEvent.click(chipByText(container, 'Minor', 'Chord qualities'));
    await fireEvent.click(startButton(container));
    const config = onStart.mock.calls[0][0];
    expect(config).toMatchObject({
      exercise: 'caged',
      cagedVariant: 'name-shape',
      enabledShapes: ['C', 'A', 'E', 'D'],
      qualities: ['major'],
      include7th: false,
      inputMode: 'click'
    });
    expect(storedPrefs()).toMatchObject({ exercise: 'caged', cagedVariant: 'name-shape', chordQualities: ['major'] });

    await fireEvent.click(chipByText(container, 'Major', 'Chord qualities'));
    expect(startButton(container).disabled).toBe(true);
  });
});

describe('StartScreen — Chord-Tone Targeting', () => {
  beforeEach(() => localStorage.clear());

  it('emits a chord-tones config and remembers its settings', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'chord-tones'));
    await fireEvent.click(chipByText(container, '12-bar blues', 'Progression'));
    await fireEvent.click(chipByText(container, '7th', 'Target'));
    await fireEvent.click(chipByText(container, 'Timed', 'Tempo'));
    await fireEvent.click(chipByText(container, '2 bars per chord', 'Bars per chord'));
    await fireEvent.click(startButton(container));
    expect(onStart.mock.calls[0][0]).toMatchObject({
      exercise: 'chord-tones', progression: 'blues', target: '7th', tempo: 'timed', bpm: 80, barsPerChord: 2
    });
    expect(storedPrefs()).toMatchObject({ exercise: 'chord-tones', progression: 'blues', toneTarget: '7th', tempo: 'timed' });
  });

  it('blocks start on an invalid tempo', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(card(container, 'chord-tones'));
    await fireEvent.click(chipByText(container, 'Timed', 'Tempo'));
    await fireEvent.input(container.querySelector('input[aria-label="BPM"]')!, { target: { value: '10' } });
    expect(startButton(container).disabled).toBe(true);
  });
});

describe('StartScreen — Call and Response', () => {
  beforeEach(() => localStorage.clear());

  it('emits a call-response config and remembers its settings', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'call-response'));
    await fireEvent.click(chipByText(container, '4 notes', 'Phrase length'));
    await fireEvent.click(chipByText(container, '2', 'Degrees'));
    await fireEvent.click(chipByText(container, 'Stepwise', 'Motion'));
    await fireEvent.click(startButton(container));
    expect(onStart.mock.calls[0][0]).toMatchObject({
      exercise: 'call-response', lengths: [3, 4], degrees: ['1', '2', '3', '5'], motion: 'stepwise', rhythm: false
    });
    expect(storedPrefs()).toMatchObject({ exercise: 'call-response', phraseLengths: [3, 4], phraseMotion: 'stepwise' });
  });

  it('needs two degrees', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(card(container, 'call-response'));
    await fireEvent.click(chipByText(container, '1', 'Degrees'));
    await fireEvent.click(chipByText(container, '3', 'Degrees'));
    expect(startButton(container).disabled).toBe(true);
  });
});

describe('StartScreen — Rhythm', () => {
  beforeEach(() => localStorage.clear());

  it('emits a rhythm config (mic by default), hides duration and frets, and remembers its settings', async () => {
    const onStart = vi.fn<(c: AnyConfig) => void>();
    const { container } = render(StartScreen, { props: { onStart } });
    await fireEvent.click(card(container, 'rhythm'));
    expect(container.querySelector('[aria-label="Frets"]')).toBeNull();
    await fireEvent.click(chipByText(container, 'The ands', 'Play on'));
    await fireEvent.click(chipByText(container, '16 bars', 'Bars'));
    await fireEvent.click(chipByText(container, '±30 ms', 'Tolerance'));
    await fireEvent.click(startButton(container));
    expect(onStart.mock.calls[0][0]).toEqual({
      exercise: 'rhythm', target: 'ands', bpm: 80, bars: 16, toleranceMs: 30, inputMode: 'mic',
      micSensitivity: 0.5, micDeviceId: null
    });
    expect(storedPrefs()).toMatchObject({ exercise: 'rhythm', rhythmTarget: 'ands', rhythmBars: 16, rhythmTolerance: 30, rhythmInput: 'mic' });
  });

  it('blocks start on an invalid tempo', async () => {
    const { container } = render(StartScreen, { props: { onStart: () => {} } });
    await fireEvent.click(card(container, 'rhythm'));
    await fireEvent.input(container.querySelector('input[aria-label="BPM"]')!, { target: { value: '300' } });
    expect(startButton(container).disabled).toBe(true);
  });
});
