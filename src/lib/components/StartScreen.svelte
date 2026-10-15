<script lang="ts">
  import { CHROMATIC, NOTE_DISPLAY, type Note, type ClosestAlgorithm, type Direction } from '../music/notes';
  import type { Interval, ScaleQuality } from '../music/scales';
  import { MODE_ORDER, MODE_DISPLAY, type Mode } from '../music/modes';
  import { loadPrefs, savePrefs, type Prefs } from '../storage/prefs';
  import type { ExerciseConfig } from '../exercise/types';
  import type { PlayShapeConfig, IdentifyModeConfig } from '../exercise/modes/types';
  import type { AnyConfig } from '../exercise/config';

  type Props = {
    onStart: (config: AnyConfig) => void;
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

  let exercise = $state<AnyConfig['exercise']>(stored.exercise ?? 'root-notes');
  let targetNote = $state<Note>(stored.targetNote ?? 'A');
  let durationSec = $state<number>(stored.durationSec ?? 300);
  let maxFret = $state<number>(stored.maxFret ?? DEFAULT_MAX_FRET);
  let showAllLabels = $state<boolean>(stored.showAllLabels ?? false);
  let showRootMarkers = $state<boolean>(stored.showRootMarkers ?? false);
  let showFretNumbers = $state<boolean>(stored.showFretNumbers ?? true);
  let playSound = $state<boolean>(stored.playSound ?? true);
  let continuous = $state<boolean>(stored.continuous ?? false);
  let algorithm = $state<ClosestAlgorithm>(stored.algorithm ?? 'fret-first');
  let intervalKind = $state<Interval | 'random'>(stored.intervalKind ?? 'random');
  let keyRoot = $state<Note | 'random'>(stored.keyRoot ?? 'C');
  let keyQuality = $state<ScaleQuality | 'random'>(stored.keyQuality ?? 'major');
  let direction = $state<Direction>(stored.direction ?? 'nearest');
  let customMode = $state<boolean>(!continuous && ![60, 180, 300, 600].includes(durationSec));
  let customValue = $state<number>(customMode ? durationSec : 120);

  // Modes-exercise settings.
  let enabledModes = $state<Mode[]>(stored.enabledModes ?? [...MODE_ORDER]);
  let shapeVariant = $state<'octave' | 'box'>(stored.shapeVariant ?? 'octave');
  let octaveJudge = $state<'pitch' | 'fixed'>(stored.octaveJudge ?? 'fixed');
  let boxSpan = $state<number>(stored.boxSpan ?? 4);

  const isModes = $derived(exercise === 'play-shape' || exercise === 'identify-mode');

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

  function toggleMode(m: Mode) {
    enabledModes = enabledModes.includes(m)
      ? enabledModes.filter(x => x !== m)
      : [...enabledModes, m];
  }

  const durationValid = $derived(continuous || durationSec > 0);
  // A box shape needs a sane span; an empty number input binds to null.
  const boxSpanValid = $derived(
    exercise !== 'play-shape' || shapeVariant !== 'box' || (Number.isInteger(boxSpan) && boxSpan >= 3)
  );
  const valid = $derived(
    durationValid && (!isModes || enabledModes.length > 0) && boxSpanValid
  );

  function handleStart() {
    if (!valid) return;
    let config: AnyConfig;
    if (exercise === 'play-shape') {
      const modes = MODE_ORDER.filter(m => enabledModes.includes(m));
      config = {
        exercise: 'play-shape',
        enabledModes: modes,
        shapeVariant,
        octaveJudge,
        boxSpan,
        maxFret,
        durationSec,
        continuous,
        showFretNumbers,
        playSound
      } satisfies PlayShapeConfig;
    } else if (exercise === 'identify-mode') {
      const modes = MODE_ORDER.filter(m => enabledModes.includes(m));
      config = {
        exercise: 'identify-mode',
        enabledModes: modes,
        maxFret,
        durationSec,
        continuous,
        showFretNumbers,
        playSound
      } satisfies IdentifyModeConfig;
    } else {
      config = {
        exercise,
        targetNote,
        durationSec,
        continuous,
        maxFret,
        showAllLabels,
        showRootMarkers,
        showFretNumbers,
        playSound,
        algorithm,
        intervalKind,
        keyRoot,
        keyQuality,
        direction
      } satisfies ExerciseConfig;
    }
    const prefs: Prefs = {
      exercise,
      targetNote,
      durationSec,
      continuous,
      maxFret,
      showAllLabels,
      showRootMarkers,
      showFretNumbers,
      playSound,
      algorithm,
      intervalKind,
      keyRoot,
      keyQuality,
      direction,
      enabledModes,
      shapeVariant,
      octaveJudge,
      boxSpan
    };
    savePrefs(prefs);
    onStart(config);
  }
</script>

<div class="start">
  <h1>Guitar Exercises</h1>

  <div class="row">
    <label for="exercise">Exercise</label>
    <select id="exercise" bind:value={exercise}>
      <option value="root-notes">Root Notes</option>
      <option value="random-roots">Random Roots</option>
      <option value="intervals">Intervals</option>
      <option value="play-shape">Play the Shape (modes)</option>
      <option value="identify-mode">Identify the Mode</option>
    </select>
  </div>

  {#if exercise === 'random-roots'}
    <div class="row">
      <span class="label">Target notes</span>
      <span class="hint">A, E, D — randomized each prompt</span>
    </div>
  {:else if exercise === 'intervals'}
    <div class="row">
      <label for="interval">Interval</label>
      <select id="interval" bind:value={intervalKind}>
        <option value="3rd">3rd</option>
        <option value="5th">5th</option>
        <option value="random">Random each prompt</option>
      </select>
    </div>
    <div class="row">
      <label for="keyroot">Key</label>
      <select id="keyroot" bind:value={keyRoot}>
        <option value="random">Random each prompt</option>
        {#each CHROMATIC as n}
          <option value={n}>{NOTE_DISPLAY[n]}</option>
        {/each}
      </select>
    </div>
    <div class="row">
      <label for="keyqual">Key quality</label>
      <select id="keyqual" bind:value={keyQuality}>
        <option value="major">Major</option>
        <option value="minor">Minor</option>
        <option value="random">Random each prompt</option>
      </select>
    </div>
    <div class="row">
      <label for="direction">Direction</label>
      <select id="direction" bind:value={direction}>
        <option value="nearest">Nearest (either way)</option>
        <option value="ascending">Ascending (higher pitch)</option>
      </select>
    </div>
  {:else if isModes}
    <div class="row">
      <span class="label">Modes</span>
      <div class="chips">
        {#each MODE_ORDER as m}
          <button
            type="button"
            class:chip={true}
            class:chip-active={enabledModes.includes(m)}
            onclick={() => toggleMode(m)}
          >{MODE_DISPLAY[m]}</button>
        {/each}
      </div>
      {#if enabledModes.length === 0}
        <span class="hint warn">Enable at least one mode.</span>
      {/if}
    </div>

    {#if exercise === 'play-shape'}
      <div class="row">
        <span class="label">Shape</span>
        <div class="chips">
          <button type="button" class:chip={true} class:chip-active={shapeVariant === 'octave'} onclick={() => (shapeVariant = 'octave')}>One octave</button>
          <button type="button" class:chip={true} class:chip-active={shapeVariant === 'box'} onclick={() => (shapeVariant = 'box')}>Position box</button>
        </div>
      </div>

      {#if shapeVariant === 'octave'}
        <div class="row">
          <span class="label">Judging</span>
          <div class="chips">
            <button type="button" class:chip={true} class:chip-active={octaveJudge === 'fixed'} onclick={() => (octaveJudge = 'fixed')}>Fixed fingering</button>
            <button type="button" class:chip={true} class:chip-active={octaveJudge === 'pitch'} onclick={() => (octaveJudge = 'pitch')}>Any position (by pitch)</button>
          </div>
        </div>
      {:else}
        <div class="row">
          <label for="span">Box span (frets)</label>
          <input id="span" type="number" min="3" step="1" bind:value={boxSpan} />
        </div>
      {/if}
    {/if}
  {:else}
    <div class="row">
      <label for="note">Root note</label>
      <select id="note" bind:value={targetNote}>
        {#each CHROMATIC as n}
          <option value={n}>{NOTE_DISPLAY[n]}</option>
        {/each}
      </select>
    </div>
  {/if}

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

  {#if !isModes}
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
  {/if}

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

  {#if !isModes}
    <div class="row">
      <label for="algorithm">Closest-position algorithm</label>
      <select id="algorithm" bind:value={algorithm}>
        <option value="fret-first">Same fret first (then closest string)</option>
        <option value="manhattan">Manhattan (fret + string distance)</option>
      </select>
    </div>
  {/if}

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
  .hint { opacity: 0.7; font-size: 14px; }
  .hint.warn { color: #e07a5f; opacity: 1; }
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
