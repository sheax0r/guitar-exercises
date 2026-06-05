<script lang="ts">
  import { CHROMATIC, NOTE_DISPLAY, type Note, type ClosestAlgorithm } from '../music/notes';
  import { loadPrefs, savePrefs, type Prefs } from '../storage/prefs';
  import type { RootNotesConfig } from '../exercise/rootNotes/types';

  type Props = {
    onStart: (config: RootNotesConfig) => void;
  };

  let { onStart }: Props = $props();

  const stored = loadPrefs();
  // Narrow-viewport heuristic for the default fret count: phones (and most
  // small tablets) can't comfortably render 24 frets at the board's 800px
  // min-width. We only consult this when no stored preference exists — once
  // the user picks a value it sticks across visits.
  const isNarrowViewport = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 768px)').matches;
  const DEFAULT_MAX_FRET = isNarrowViewport ? 12 : 24;

  let targetNote = $state<Note>(stored.targetNote ?? 'A');
  let durationSec = $state<number>(stored.durationSec ?? 300);
  let maxFret = $state<number>(stored.maxFret ?? DEFAULT_MAX_FRET);
  let showAllLabels = $state<boolean>(stored.showAllLabels ?? false);
  let showRootMarkers = $state<boolean>(stored.showRootMarkers ?? false);
  let showFretNumbers = $state<boolean>(stored.showFretNumbers ?? true);
  let playSound = $state<boolean>(stored.playSound ?? true);
  let continuous = $state<boolean>(stored.continuous ?? false);
  let algorithm = $state<ClosestAlgorithm>(stored.algorithm ?? 'fret-first');
  let customMode = $state<boolean>(!continuous && ![60, 180, 300, 600].includes(durationSec));
  let customValue = $state<number>(customMode ? durationSec : 120);

  const DURATIONS = [
    { label: '1m', sec: 60 },
    { label: '3m', sec: 180 },
    { label: '5m', sec: 300 },
    { label: '10m', sec: 600 }
  ];

  const FRET_OPTIONS = [12, 22, 24];

  function pickPreset(sec: number) {
    continuous = false;
    customMode = false;
    durationSec = sec;
  }

  function pickCustom() {
    continuous = false;
    customMode = true;
    durationSec = customValue > 0 ? customValue : 120;
  }

  function pickContinuous() {
    continuous = true;
    customMode = false;
  }

  function onCustomChange(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!Number.isFinite(v) || v <= 0) {
      customValue = 0;
      return;
    }
    customValue = v;
    if (customMode) durationSec = v;
  }

  const valid = $derived(continuous || durationSec > 0);

  function handleStart() {
    if (!valid) return;
    const config: RootNotesConfig = {
      targetNote,
      durationSec,
      continuous,
      maxFret,
      showAllLabels,
      showRootMarkers,
      showFretNumbers,
      playSound,
      algorithm
    };
    const prefs: Prefs = { targetNote, durationSec, continuous, maxFret, showAllLabels, showRootMarkers, showFretNumbers, playSound, algorithm };
    savePrefs(prefs);
    onStart(config);
  }
</script>

<div class="start">
  <h1>Guitar Exercises</h1>

  <div class="row">
    <label for="exercise">Exercise</label>
    <select id="exercise" disabled>
      <option>Root Notes</option>
    </select>
  </div>

  <div class="row">
    <label for="note">Root note</label>
    <select id="note" bind:value={targetNote}>
      {#each CHROMATIC as n}
        <option value={n}>{NOTE_DISPLAY[n]}</option>
      {/each}
    </select>
  </div>

  <div class="row">
    <span class="label">Duration</span>
    <div class="chips">
      {#each DURATIONS as d}
        <button
          type="button"
          class:chip={true}
          class:chip-active={!continuous && !customMode && durationSec === d.sec}
          onclick={() => pickPreset(d.sec)}
        >{d.label}</button>
      {/each}
      <button
        type="button"
        class:chip={true}
        class:chip-active={!continuous && customMode}
        onclick={pickCustom}
      >Custom</button>
      {#if !continuous && customMode}
        <input
          type="number"
          min="1"
          step="1"
          value={customValue}
          oninput={onCustomChange}
          aria-label="Custom duration in seconds"
        />
        <span class="hint">seconds</span>
      {/if}
      <button
        type="button"
        class:chip={true}
        class:chip-active={continuous}
        onclick={pickContinuous}
      >Continuous</button>
    </div>
  </div>

  <div class="row">
    <span class="label">Frets</span>
    <div class="chips">
      {#each FRET_OPTIONS as n}
        <button
          type="button"
          class:chip={true}
          class:chip-active={maxFret === n}
          onclick={() => (maxFret = n)}
        >{n}</button>
      {/each}
    </div>
  </div>

  <div class="row">
    <label>
      <input type="checkbox" bind:checked={showAllLabels} />
      Show all labels (warm-up mode)
    </label>
  </div>

  <div class="row">
    <label>
      <input type="checkbox" bind:checked={showRootMarkers} />
      Show root note positions
    </label>
  </div>

  <div class="row">
    <label>
      <input type="checkbox" bind:checked={showFretNumbers} />
      Show fret numbers
    </label>
  </div>

  <div class="row">
    <label>
      <input type="checkbox" bind:checked={playSound} />
      Play notes
    </label>
  </div>

  <div class="row">
    <label for="algorithm">Closest-position algorithm</label>
    <select id="algorithm" bind:value={algorithm}>
      <option value="fret-first">Same fret first (then closest string)</option>
      <option value="manhattan">Manhattan (fret + string distance)</option>
    </select>
  </div>

  <button class="start-button" disabled={!valid} onclick={handleStart}>Start</button>
</div>

<style>
  .start {
    max-width: 600px;
    margin: 40px auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .row { display: flex; flex-direction: column; gap: 8px; }
  .label { font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip {
    padding: 8px 16px;
    border: 1px solid #888;
    background: transparent;
    border-radius: 999px;
    cursor: pointer;
    color: inherit;
  }
  .chip-active {
    background: #ff8c42;
    color: #1a1a1a;
    border-color: #ff8c42;
    font-weight: 700;
  }
  .start-button {
    padding: 14px 24px;
    font-size: 16px;
    font-weight: 700;
    background: #5fb35a;
    color: #0a0a0a;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  .start-button:disabled { opacity: 0.5; cursor: not-allowed; }
  input[type="number"] { width: 80px; padding: 6px; }
</style>
