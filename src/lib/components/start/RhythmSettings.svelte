<script lang="ts">
  import { BAR_COUNTS, TOLERANCES_MS, type RhythmTarget } from '../../exercise/rhythm/types';
  import { hasCalib } from '../../audio/calibration';
  import { IDEATE_HASH } from '../../routing/hash';
  import ChipGroup from './ChipGroup.svelte';
  import MicSettings from '../MicSettings.svelte';

  type Props = {
    target: RhythmTarget;               // $bindable
    bpm: number;                        // $bindable
    bars: number;                       // $bindable
    tolerance: number;                  // $bindable
    inputMode: 'click' | 'mic';         // $bindable
    micSensitivity: number;             // $bindable
    micDeviceId: string | null;         // $bindable
    micDevices: Array<{ deviceId: string; label: string }>;
  };
  let {
    target = $bindable(),
    bpm = $bindable(),
    bars = $bindable(),
    tolerance = $bindable(),
    inputMode = $bindable(),
    micSensitivity = $bindable(),
    micDeviceId = $bindable(),
    micDevices
  }: Props = $props();

  const calibrated = hasCalib();
</script>

<div class="row">
  <span class="label">Play on</span>
  <ChipGroup
    bind:value={target}
    label="Play on"
    options={[
      { value: 'one', label: 'Beat 1' },
      { value: 'beats', label: 'Every beat' },
      { value: 'ands', label: 'The ands', title: 'Offbeat eighths: between the clicks' },
      { value: 'pattern', label: 'Patterns', title: 'Charleston, backbeat, tresillo, push; one per bar' }
    ]}
  />
</div>
<div class="row">
  <span class="label">Tempo</span>
  <label class="field">BPM <input type="number" min="40" max="200" step="1" bind:value={bpm} aria-label="BPM" /></label>
  <ChipGroup bind:value={bars} label="Bars" options={BAR_COUNTS.map(n => ({ value: n, label: `${n} bars` }))} />
</div>
<div class="row">
  <span class="label">Tolerance</span>
  <ChipGroup bind:value={tolerance} label="Tolerance" options={TOLERANCES_MS.map(n => ({ value: n, label: `±${n} ms` }))} />
  <span class="hint">A note within this of its target is a hit. Missed targets and extra notes count against accuracy.</span>
</div>
<div class="row">
  <span class="label">Input</span>
  <ChipGroup
    bind:value={inputMode}
    label="Input"
    options={[
      { value: 'mic', label: 'Play (mic)' },
      { value: 'click', label: 'Tap (no mic)', title: 'Tap a key or the on-screen pad' }
    ]}
  />
  {#if inputMode === 'mic'}
    <MicSettings bind:sensitivity={micSensitivity} bind:deviceId={micDeviceId} devices={micDevices} />
    <span class="hint">
      Any note counts; only its timing is judged. Headphones keep the click out of the mic.
      {#if calibrated}Uses your saved latency calibration.{:else}No latency calibration saved yet: <a href={IDEATE_HASH}>calibrate in Ideate</a> (More options → Calibration) so late input isn't scored as late playing.{/if}
    </span>
  {:else}
    <span class="hint">Tap any key (not space) or the pad. Keyboard and touch latency isn't corrected, so a few ms of late bias is normal.</span>
  {/if}
</div>

<style>
  .field { display: inline-flex; align-items: center; gap: 8px; }
  .field input { width: 5em; }
</style>
