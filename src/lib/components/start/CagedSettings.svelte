<script lang="ts">
  import type { Note } from '../../music/notes';
  import { CAGED_ORDER, type CagedShape, type ChordQuality } from '../../music/caged';
  import type { CagedVariant } from '../../exercise/caged/types';
  import ChipGroup from './ChipGroup.svelte';
  import NotePicker from './NotePicker.svelte';
  import MicSettings from '../MicSettings.svelte';

  type Props = {
    cagedVariant: CagedVariant;          // $bindable
    enabledShapes: CagedShape[];         // $bindable
    chordQualities: ChordQuality[];      // $bindable
    include7th: boolean;                 // $bindable
    inputMode: 'click' | 'mic';          // $bindable
    micSensitivity: number;              // $bindable
    micDeviceId: string | null;          // $bindable
    micDevices: Array<{ deviceId: string; label: string }>;
    fixedRootNote: Note | 'random';      // $bindable
  };
  let {
    cagedVariant = $bindable(),
    enabledShapes = $bindable(),
    chordQualities = $bindable(),
    include7th = $bindable(),
    inputMode = $bindable(),
    micSensitivity = $bindable(),
    micDeviceId = $bindable(),
    micDevices,
    fixedRootNote = $bindable()
  }: Props = $props();

  const toggle = <T,>(xs: T[], x: T): T[] => (xs.includes(x) ? xs.filter(y => y !== x) : [...xs, x]);
</script>

<div class="row">
  <span class="label">Drill</span>
  <ChipGroup
    bind:value={cagedVariant}
    label="Drill"
    options={[
      { value: 'find-tones', label: 'Find the chord tones' },
      { value: 'name-shape', label: 'Name the shape' },
      { value: 'next-shape', label: 'Next shape up' }
    ]}
  />
</div>

<div class="row">
  <span class="label">Shapes</span>
  <div class="chips" role="group" aria-label="Shapes">
    {#each CAGED_ORDER as s}
      <button
        type="button"
        class="chip"
        class:chip-active={enabledShapes.includes(s)}
        aria-pressed={enabledShapes.includes(s)}
        onclick={() => (enabledShapes = toggle(enabledShapes, s))}
      >{s}</button>
    {/each}
  </div>
  {#if enabledShapes.length === 0}<span class="hint warn">Enable at least one shape.</span>{/if}
</div>

<div class="row">
  <span class="label">Chords</span>
  <div class="chips" role="group" aria-label="Chord qualities">
    {#each [['major', 'Major'], ['minor', 'Minor']] as [q, label]}
      <button
        type="button"
        class="chip"
        class:chip-active={chordQualities.includes(q as ChordQuality)}
        aria-pressed={chordQualities.includes(q as ChordQuality)}
        onclick={() => (chordQualities = toggle(chordQualities, q as ChordQuality))}
      >{label}</button>
    {/each}
  </div>
  <label><input type="checkbox" bind:checked={include7th} /> Include the 7th (maj7 / 7 / m7)</label>
  {#if chordQualities.length === 0}<span class="hint warn">Enable at least one chord quality.</span>{/if}
</div>

{#if cagedVariant === 'find-tones'}
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
      <span class="hint">Notes are matched by pitch class inside the shape, in any order.</span>
    {/if}
  </div>
{/if}

<div class="row">
  <span class="label">Chord root</span>
  <NotePicker bind:value={fixedRootNote} label="Chord root" randomLabel="Random" />
</div>

<style>
  .hint.warn { color: #e07a5f; opacity: 1; }
</style>
