<script lang="ts">
  // Ideate: whistle, hum, sing or play into the mic (or upload a clip) and get a Guitar Pro
  // tab. Ported from Whistler; lazy-loaded from App.svelte so none of it reaches Learn.
  import { onMount } from 'svelte';
  import { listAudioInputs } from '../audio/pitch';
  import { noteName } from '../transcribe/fretting';
  import ChipGroup from './start/ChipGroup.svelte';
  import MicSettings from './MicSettings.svelte';
  import Recorder from '../ideate/Recorder.svelte';
  import Calibration from '../ideate/Calibration.svelte';
  import SeparationToggle from '../ideate/SeparationToggle.svelte';
  import JobsDrawer from '../ideate/JobsDrawer.svelte';
  import CleanupPanel from '../ideate/CleanupPanel.svelte';
  import { settings, setInstrument, ui, loadJobs, currentJob, type Job } from '../ideate/state.svelte';

  const START_NOTES = Array.from({ length: 72 - 40 + 1 }, (_, i) => 40 + i); // E2..C5
  let devices = $state<Array<{ deviceId: string; label: string }>>([]);
  const refreshDevices = async () => (devices = await listAudioInputs());

  onMount(() => {
    loadJobs();
    refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
  });

  const current = $derived(currentJob());
  let panelEl = $state<HTMLElement>();

  function openJob(j: Job) {
    if (j.status !== 'done') return;
    ui.currentId = j.id;
    ui.drawerOpen = false;
    queueMicrotask(() => panelEl?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  }

  // A new calibration applies to the open job immediately.
  function onCalibrated(ms: number) {
    if (current) current.offset = ms;
  }
</script>

<div class="ideate">
  <div class="title">
    <h1>Ideate</h1>
    <JobsDrawer onOpen={openJob} />
  </div>
  <p class="hint">Whistle, hum, sing or play to the click, and get a Guitar Pro tab.</p>

  <div class="grid">
    <div class="row">
      <span class="label">Time signature</span>
      <div class="sig">
        <input type="number" min="1" max="16" bind:value={settings.num} aria-label="Beats per bar" />
        <span>/</span>
        <select bind:value={settings.den} aria-label="Beat value">
          {#each [2, 4, 8, 16] as d}<option value={d}>{d}</option>{/each}
        </select>
      </div>
    </div>
    <div class="row">
      <label class="label" for="bpm">Tempo: {settings.bpm} BPM</label>
      <div class="bpm">
        <input id="bpm" type="number" min="30" max="300" bind:value={settings.bpm} aria-label="Tempo in BPM" />
        <input type="range" min="30" max="300" bind:value={settings.bpm} aria-label="Tempo dial" />
      </div>
    </div>
  </div>

  <div class="row">
    <span class="label">Input</span>
    <ChipGroup
      value={settings.instrument}
      onpick={setInstrument}
      label="Input instrument"
      options={[
        { value: 'guitar', label: 'Guitar' },
        { value: 'whistle', label: 'Whistle' },
        { value: 'humming', label: 'Humming' },
        { value: 'singing', label: 'Singing' }
      ]}
    />
  </div>

  <div class="row">
    <span class="label">Engine</span>
    <ChipGroup
      bind:value={settings.engine}
      label="Transcription engine"
      options={[
        { value: 'pitchy', label: 'pitchy', title: 'Monophonic, instant' },
        { value: 'ai', label: 'Basic Pitch (AI)', title: 'Polyphonic, ~1 MB model on first use' }
      ]}
    />
    <span class="hint">{settings.engine === 'ai' ? 'Neural net: chords and real durations, absolute pitch. ~1 MB on first use.' : 'Single-note pitch tracker, instant.'}</span>
  </div>

  <div class="row">
    <label class="label" for="startnote">Start note (reference)</label>
    <select id="startnote" bind:value={settings.startNote}>
      {#each START_NOTES as m}<option value={m}>{noteName(m)}</option>{/each}
    </select>
    <span class="hint">Heard during the count-in.</span>
  </div>

  <MicSettings bind:deviceId={settings.deviceId} {devices} />

  <div class="chips toggles">
    <label class="chip" class:chip-active={settings.countIn}><input type="checkbox" bind:checked={settings.countIn} /> Count-in</label>
    <label class="chip" class:chip-active={settings.metro}><input type="checkbox" bind:checked={settings.metro} /> Click while recording</label>
    <label class="chip" class:chip-active={settings.playPitch}><input type="checkbox" bind:checked={settings.playPitch} /> Sound start note</label>
    <label class="chip" class:chip-active={settings.snap}><input type="checkbox" bind:checked={settings.snap} /> Snap to start note</label>
  </div>

  <div class="row">
    <label class="label" for="metrovol">Metronome volume</label>
    <input id="metrovol" type="range" min="0" max="1" step="0.05" bind:value={settings.metroVol} />
  </div>

  <Recorder onMicOpened={refreshDevices} />

  <details class="more">
    <summary>More options</summary>
    <div class="more-body">
      <Calibration {onCalibrated} />
      <SeparationToggle />
      <div class="row">
        <span class="label">Detection (pitchy engine)</span>
        <div class="detect">
          <label>Clarity min <input type="number" min="0" max="1" step="0.01" bind:value={settings.clarity} /></label>
          <label>Min note (ms) <input type="number" min="10" max="500" bind:value={settings.minMs} /></label>
          <label>Merge gap (ms) <input type="number" min="0" max="300" bind:value={settings.mergeMs} /></label>
        </div>
      </div>
    </div>
  </details>

  {#if current}
    <div bind:this={panelEl}>
      {#key current.id}<CleanupPanel job={current} />{/key}
    </div>
  {/if}
</div>

<style>
  .ideate {
    max-width: 600px;
    margin: 24px auto 0;
    padding: 0 16px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-sizing: border-box;
  }
  .title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  h1 { margin: 0; }
  .hint { margin: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sig, .bpm { display: flex; gap: 6px; align-items: center; }
  .sig input { width: 52px; }
  .bpm input[type='number'] { width: 64px; }
  .bpm input[type='range'] { flex: 1; min-width: 0; }
  input[type='number'], select { padding: 6px; font: inherit; max-width: 100%; }
  .toggles .chip { display: inline-flex; gap: 6px; align-items: center; user-select: none; }
  .toggles input { margin: 0; }
  .more summary { cursor: pointer; font-weight: 600; }
  .more-body { display: flex; flex-direction: column; gap: 20px; margin-top: 12px; }
  .detect { display: flex; flex-wrap: wrap; gap: 12px; }
  .detect label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
  .detect input { width: 90px; }
  @media (max-width: 420px) {
    .grid { grid-template-columns: 1fr; }
  }
</style>
