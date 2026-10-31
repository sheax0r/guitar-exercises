<script lang="ts">
  import type { Note, ClosestAlgorithm, Direction } from '../music/notes';
  import type { Interval, ScaleQuality } from '../music/scales';
  import { MODE_ORDER, type Mode } from '../music/modes';
  import { loadPrefs, savePrefs, type Prefs } from '../storage/prefs';
  import { pushRecent } from '../storage/recent';
  import { summarize } from '../exercise/summary';
  import { parseHash, sessionHash } from '../routing/hash';
  import type { AnyConfig } from '../exercise/config';
  import { DEFAULT_MIC_SENSITIVITY } from '../audio/pitchMath';
  import { listAudioInputs } from '../audio/pitch';
  import ChipGroup from './start/ChipGroup.svelte';
  import DurationPicker from './start/DurationPicker.svelte';
  import RootNotesSettings from './start/RootNotesSettings.svelte';
  import IntervalsSettings from './start/IntervalsSettings.svelte';
  import ModesSettings from './start/ModesSettings.svelte';

  type Props = {
    onStart: (config: AnyConfig) => void;
  };

  let { onStart }: Props = $props();

  type Card = 'root-notes' | 'intervals' | 'play-shape' | 'identify-mode';
  const CARD_GROUPS: Array<{ title: string; cards: Array<{ id: Card; name: string; desc: string }> }> = [
    {
      title: 'Fretboard',
      cards: [
        { id: 'root-notes', name: 'Root Notes', desc: 'Find the nearest occurrence of a note.' },
        { id: 'intervals', name: 'Intervals', desc: 'Find the 3rd or 5th above a note, in key.' }
      ]
    },
    {
      title: 'Modes',
      cards: [
        { id: 'play-shape', name: 'Play the Shape', desc: 'Play a mode as an octave run or position box.' },
        { id: 'identify-mode', name: 'Identify the Mode', desc: 'Name the mode from its notes or its sound.' }
      ]
    }
  ];

  const stored = loadPrefs();
  // Narrow-viewport heuristic for the default fret count: phones (and most
  // small tablets) can't comfortably render 24 frets at the board's 800px
  // min-width. We only consult this when no stored preference exists — once
  // the user picks a value it sticks across visits.
  const isNarrowViewport = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 768px)').matches;
  const DEFAULT_MAX_FRET = isNarrowViewport ? 12 : 24;

  // random-roots is Root Notes with the A/E/D target.
  let card = $state<Card>(stored.exercise === 'random-roots' ? 'root-notes' : stored.exercise ?? 'root-notes');
  let rootTarget = $state<Note | 'random'>(stored.exercise === 'random-roots' ? 'random' : stored.targetNote ?? 'A');
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

  // Modes-exercise settings.
  let enabledModes = $state<Mode[]>(stored.enabledModes ?? [...MODE_ORDER]);
  let shapeVariant = $state<'octave' | 'box'>(stored.shapeVariant ?? 'octave');
  let octaveJudge = $state<'pitch' | 'fixed'>(stored.octaveJudge ?? 'fixed');
  let boxSpan = $state<number>(stored.boxSpan ?? 4);

  // Modes sound/ear settings.
  let drone = $state<boolean>(stored.drone ?? false);
  let highlightCharacteristic = $state<boolean>(stored.highlightCharacteristic ?? false);
  let fixedRootNote = $state<Note | 'random'>(stored.fixedRootNote ?? 'random');
  let inputMode = $state<'click' | 'mic'>(stored.inputMode ?? 'click');
  let identifyPromptMode = $state<'visual' | 'audio'>(stored.identifyPromptMode ?? 'visual');
  let displayNotePercentage = $state<number>(stored.displayNotePercentage ?? 100);
  let micSensitivity = $state<number>(stored.micSensitivity ?? DEFAULT_MIC_SENSITIVITY);
  let micDeviceId = $state<string | null>(stored.micDeviceId ?? null);
  let micDevices = $state<Array<{ deviceId: string; label: string }>>([]);
  // Best-effort device list (labels appear only after mic permission).
  $effect(() => { listAudioInputs().then(d => { micDevices = d; }); });

  // Stored hashes that no longer parse (or aren't strings) are skipped.
  const recents = (Array.isArray(stored.recentSessions) ? stored.recentSessions : [])
    .filter((h): h is string => typeof h === 'string')
    .flatMap(hash => {
      const route = parseHash(hash);
      return route.screen === 'session' ? [{ hash, config: route.config }] : [];
    });

  const exercise = $derived<AnyConfig['exercise']>(
    card === 'root-notes' && rootTarget === 'random' ? 'random-roots' : card
  );
  // random-roots ignores targetNote; keep the last fixed pick.
  // svelte-ignore state_referenced_locally
  let lastFixedTarget = $state<Note>(rootTarget === 'random' ? (stored.targetNote ?? 'A') : rootTarget);
  $effect(() => { if (rootTarget !== 'random') lastFixedTarget = rootTarget; });
  const targetNote = $derived<Note>(rootTarget === 'random' ? lastFixedTarget : rootTarget);
  const isModes = $derived(card === 'play-shape' || card === 'identify-mode');

  const durationValid = $derived(continuous || durationSec > 0);
  // A box shape needs a sane span; an empty number input binds to null.
  const boxSpanValid = $derived(
    card !== 'play-shape' || shapeVariant !== 'box' || (Number.isInteger(boxSpan) && boxSpan >= 3)
  );
  const valid = $derived(
    durationValid && (!isModes || enabledModes.length > 0) && boxSpanValid
  );

  function buildConfig(): AnyConfig {
    const modes = MODE_ORDER.filter(m => enabledModes.includes(m));
    const root = fixedRootNote === 'random' ? null : fixedRootNote;
    if (card === 'play-shape') {
      return {
        exercise: 'play-shape',
        enabledModes: modes,
        shapeVariant,
        octaveJudge,
        boxSpan,
        maxFret,
        durationSec,
        continuous,
        showFretNumbers,
        playSound,
        drone,
        highlightCharacteristic,
        fixedRootNote: root,
        // Mic can't verify a fixed-fingering octave (ModesSettings also reverts the chip).
        inputMode: shapeVariant === 'box' || octaveJudge === 'pitch' ? inputMode : 'click',
        micSensitivity,
        micDeviceId,
        displayNotePercentage
      };
    }
    if (card === 'identify-mode') {
      return {
        exercise: 'identify-mode',
        enabledModes: modes,
        maxFret,
        durationSec,
        continuous,
        showFretNumbers,
        playSound,
        drone,
        highlightCharacteristic,
        fixedRootNote: root,
        promptMode: identifyPromptMode,
        displayNotePercentage
      };
    }
    return {
      exercise: exercise as 'root-notes' | 'random-roots' | 'intervals',
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
    };
  }

  const summary = $derived(summarize(buildConfig()));

  function handleStart() {
    if (!valid) return;
    const config = buildConfig();
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
      boxSpan,
      drone,
      highlightCharacteristic,
      fixedRootNote,
      inputMode,
      identifyPromptMode,
      micSensitivity,
      micDeviceId,
      displayNotePercentage,
      recentSessions: rememberRecent(config, sessionHash(config))
    };
    savePrefs(prefs);
    onStart(config);
  }

  // Hashes carry fields the exercise ignores, so entries that read the same are
  // dropped as duplicates; unparseable stored entries are pruned too.
  function rememberRecent(config: AnyConfig, hash: string): string[] {
    const label = summarize(config);
    return pushRecent(recents.filter(r => summarize(r.config) !== label).map(r => r.hash), hash);
  }

  function startRecent(r: { hash: string; config: AnyConfig }) {
    // The mic device isn't in the hash; use the one currently chosen.
    const config = r.config.exercise === 'play-shape' ? { ...r.config, micDeviceId } : r.config;
    savePrefs({ ...loadPrefs(), recentSessions: rememberRecent(r.config, r.hash) } as Prefs);
    onStart(config);
  }
</script>

<div class="start">
  <h1>Learn</h1>

  {#if recents.length > 0}
    <div class="row">
      <span class="label">Recent</span>
      <div class="chips">
        {#each recents as r}
          <button type="button" class="chip recent" onclick={() => startRecent(r)}>{summarize(r.config)}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#each CARD_GROUPS as g}
    <section class="row">
      <h2>{g.title}</h2>
      <div class="cards">
        {#each g.cards as c}
          <button
            type="button"
            class="card"
            class:card-active={card === c.id}
            data-exercise={c.id}
            aria-pressed={card === c.id}
            onclick={() => (card = c.id)}
          >
            <strong>{c.name}</strong>
            <span>{c.desc}</span>
          </button>
        {/each}
      </div>
    </section>
  {/each}

  {#if card === 'root-notes'}
    <RootNotesSettings bind:target={rootTarget} />
  {:else if card === 'intervals'}
    <IntervalsSettings bind:intervalKind bind:keyRoot bind:keyQuality bind:direction />
  {:else}
    <ModesSettings
      exercise={card}
      bind:enabledModes
      bind:shapeVariant
      bind:octaveJudge
      bind:boxSpan
      bind:inputMode
      bind:micSensitivity
      bind:micDeviceId
      {micDevices}
      bind:identifyPromptMode
      bind:fixedRootNote
    />
  {/if}

  <div class="row">
    <span class="label">Duration</span>
    <DurationPicker bind:durationSec bind:continuous />
  </div>

  <div class="row">
    <span class="label">Frets</span>
    <ChipGroup
      bind:value={maxFret}
      label="Frets"
      options={[12, 22, 24].map(n => ({ value: n, label: String(n) }))}
    />
  </div>

  <details class="more">
    <summary>More options</summary>
    <div class="more-body">
      <label><input type="checkbox" bind:checked={showFretNumbers} /> Show fret numbers</label>
      <label><input type="checkbox" bind:checked={playSound} /> Play notes</label>
      {#if isModes}
        <label><input type="checkbox" bind:checked={drone} /> Drone the root</label>
        <label><input type="checkbox" bind:checked={highlightCharacteristic} /> Highlight the characteristic note</label>
        <div class="row">
          <label class="label" for="shownotes">Show scale notes: {displayNotePercentage}%</label>
          <input id="shownotes" type="range" min="0" max="100" step="5" bind:value={displayNotePercentage} />
          <span class="hint">Lower it to hide a random share of the notes and make the exercise harder.</span>
        </div>
      {:else}
        <label><input type="checkbox" bind:checked={showAllLabels} /> Show all labels (warm-up mode)</label>
        <label><input type="checkbox" bind:checked={showRootMarkers} /> Show root note positions</label>
        <div class="row">
          <span class="label">Closest-position algorithm</span>
          <ChipGroup
            bind:value={algorithm}
            label="Closest-position algorithm"
            options={[
              { value: 'fret-first', label: 'Same fret first', title: 'Then closest string' },
              { value: 'manhattan', label: 'Manhattan', title: 'Fret + string distance' }
            ]}
          />
        </div>
      {/if}
    </div>
  </details>

  <div class="start-bar">
    <span class="summary">{summary}</span>
    <button class="start-button" disabled={!valid} onclick={handleStart}>Start</button>
  </div>
</div>

<style>
  .start {
    max-width: 600px;
    margin: 40px auto 0;
    padding: 24px 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin: 0; }
  .cards { display: grid; grid-template-columns: 1fr; gap: 8px; }
  @media (min-width: 520px) {
    .cards { grid-template-columns: 1fr 1fr; }
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    padding: 12px 14px;
    border: 1px solid #888;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .card span { opacity: 0.7; font-size: 14px; }
  .card-active { border-color: #ff8c42; box-shadow: inset 0 0 0 1px #ff8c42; }
  .more summary { cursor: pointer; font-weight: 600; }
  .more-body { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
  .start-bar {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    background: Canvas;
    border-top: 1px solid #888;
  }
  .summary { flex: 1; min-width: 0; font-size: 14px; opacity: 0.85; }
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
</style>
