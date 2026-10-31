<script lang="ts">
  import type { Note } from '../../music/notes';
  import type { Degree } from '../../music/scales';
  import { PHRASE_DEGREES } from '../../exercise/callresponse/types';
  import ChipGroup from './ChipGroup.svelte';
  import NotePicker from './NotePicker.svelte';
  import MicSettings from '../MicSettings.svelte';

  type Props = {
    lengths: number[];                   // $bindable
    degrees: Degree[];                   // $bindable
    motion: 'stepwise' | 'leaps';        // $bindable
    showStart: boolean;                  // $bindable
    rhythm: boolean;                     // $bindable
    keyRoot: Note | 'random';            // $bindable
    inputMode: 'click' | 'mic';          // $bindable
    micSensitivity: number;              // $bindable
    micDeviceId: string | null;          // $bindable
    micDevices: Array<{ deviceId: string; label: string }>;
  };
  let {
    lengths = $bindable(),
    degrees = $bindable(),
    motion = $bindable(),
    showStart = $bindable(),
    rhythm = $bindable(),
    keyRoot = $bindable(),
    inputMode = $bindable(),
    micSensitivity = $bindable(),
    micDeviceId = $bindable(),
    micDevices
  }: Props = $props();

  const toggle = <T,>(xs: T[], x: T): T[] => (xs.includes(x) ? xs.filter(y => y !== x) : [...xs, x]);
</script>

<div class="row">
  <span class="label">Phrase length</span>
  <div class="chips" role="group" aria-label="Phrase length">
    {#each [2, 3, 4] as n}
      <button type="button" class="chip" class:chip-active={lengths.includes(n)} aria-pressed={lengths.includes(n)}
        onclick={() => (lengths = toggle(lengths, n))}>{n} notes</button>
    {/each}
  </div>
  {#if lengths.length === 0}<span class="hint warn">Pick at least one length.</span>{/if}
</div>
<div class="row">
  <span class="label">Degrees</span>
  <div class="chips" role="group" aria-label="Degrees">
    {#each PHRASE_DEGREES as d}
      <button type="button" class="chip" class:chip-active={degrees.includes(d)} aria-pressed={degrees.includes(d)}
        onclick={() => (degrees = toggle(degrees, d))}>{d}</button>
    {/each}
  </div>
  {#if degrees.length < 2}<span class="hint warn">Pick at least two degrees.</span>{/if}
</div>
<div class="row">
  <span class="label">Motion</span>
  <ChipGroup
    bind:value={motion}
    label="Motion"
    options={[
      { value: 'stepwise', label: 'Stepwise', title: 'Each note moves to a neighbouring allowed degree' },
      { value: 'leaps', label: 'Leaps', title: 'Any allowed degree' }
    ]}
  />
  <label><input type="checkbox" bind:checked={showStart} /> Show the starting note</label>
</div>
<div class="row">
  <span class="label">Key</span>
  <NotePicker bind:value={keyRoot} label="Key" randomLabel="Random" />
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
    <label><input type="checkbox" bind:checked={rhythm} /> Judge rhythm too (eighths and quarters)</label>
  {/if}
  <span class="hint">Notes are judged in order by pitch; any octave counts.</span>
</div>

<style>
  .hint.warn { color: #e07a5f; opacity: 1; }
</style>
