<script lang="ts">
  import type { Note } from '../../music/notes';
  import { PROGRESSION_ORDER, PROGRESSION_DISPLAY, type ProgressionId } from '../../music/progressions';
  import type { ToneTarget } from '../../exercise/chordtones/types';
  import ChipGroup from './ChipGroup.svelte';
  import NotePicker from './NotePicker.svelte';
  import MicSettings from '../MicSettings.svelte';

  type Props = {
    progression: ProgressionId;          // $bindable
    keyRoot: Note | 'random';            // $bindable
    toneTarget: ToneTarget;              // $bindable
    backing: 'chord' | 'drone' | 'off';  // $bindable
    tempo: 'untimed' | 'timed';          // $bindable
    bpm: number;                         // $bindable
    barsPerChord: number;                // $bindable
    inputMode: 'click' | 'mic';          // $bindable
    micSensitivity: number;              // $bindable
    micDeviceId: string | null;          // $bindable
    micDevices: Array<{ deviceId: string; label: string }>;
  };
  let {
    progression = $bindable(),
    keyRoot = $bindable(),
    toneTarget = $bindable(),
    backing = $bindable(),
    tempo = $bindable(),
    bpm = $bindable(),
    barsPerChord = $bindable(),
    inputMode = $bindable(),
    micSensitivity = $bindable(),
    micDeviceId = $bindable(),
    micDevices
  }: Props = $props();
</script>

<div class="row">
  <span class="label">Progression</span>
  <ChipGroup bind:value={progression} label="Progression" options={PROGRESSION_ORDER.map(p => ({ value: p, label: PROGRESSION_DISPLAY[p] }))} />
</div>
<div class="row">
  <span class="label">Key</span>
  <NotePicker bind:value={keyRoot} label="Key" randomLabel="Random" />
</div>
<div class="row">
  <span class="label">Target</span>
  <ChipGroup
    bind:value={toneTarget}
    label="Target"
    options={[
      { value: 'any', label: 'Any chord tone', title: 'Any chord tone except the note you just played' },
      { value: '3rd', label: '3rd' },
      { value: '7th', label: '7th' },
      { value: 'guide', label: 'Guide tones', title: 'Alternate 3rd and 7th' }
    ]}
  />
  <span class="hint">Play the target nearest the note you played on the last chord.</span>
</div>
<div class="row">
  <span class="label">Backing</span>
  <ChipGroup
    bind:value={backing}
    label="Backing"
    options={[
      { value: 'chord', label: 'Chord' },
      { value: 'drone', label: 'Root drone' },
      { value: 'off', label: 'Off' }
    ]}
  />
</div>
<div class="row">
  <span class="label">Tempo</span>
  <ChipGroup
    bind:value={tempo}
    label="Tempo"
    options={[
      { value: 'untimed', label: 'Untimed', title: 'Advance on each answer' },
      { value: 'timed', label: 'Timed', title: 'Metronome; a missed change is a miss' }
    ]}
  />
  {#if tempo === 'timed'}
    <label class="field">BPM <input type="number" min="40" max="200" step="1" bind:value={bpm} aria-label="BPM" /></label>
    <ChipGroup bind:value={barsPerChord} label="Bars per chord" options={[{ value: 1, label: '1 bar per chord' }, { value: 2, label: '2 bars per chord' }]} />
  {/if}
</div>
<div class="row">
  <span class="label">Input</span>
  <ChipGroup
    bind:value={inputMode}
    label="Input"
    options={[
      { value: 'click', label: 'Click the notes' },
      { value: 'mic', label: 'Play (mic)' }
    ]}
  />
  {#if inputMode === 'mic'}
    <MicSettings bind:sensitivity={micSensitivity} bind:deviceId={micDeviceId} devices={micDevices} />
    <span class="hint">The note counts when it is within 3 frets of the nearest target. Timed mode uses the latency calibration from Ideate.</span>
  {/if}
</div>

<style>
  .field { display: inline-flex; align-items: center; gap: 8px; }
  .field input { width: 5em; }
</style>
