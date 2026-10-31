<script lang="ts">
  import type { Note, Direction } from '../../music/notes';
  import { INTERVAL_ORDER, type Interval, type ScaleQuality } from '../../music/scales';
  import ChipGroup from './ChipGroup.svelte';
  import NotePicker from './NotePicker.svelte';

  type Props = {
    intervals: Interval[];             // $bindable
    intervalRef: 'diatonic-from-note' | 'from-root'; // $bindable
    keyRoot: Note | 'random';          // $bindable
    keyQuality: ScaleQuality | 'random'; // $bindable
    direction: Direction;              // $bindable
  };
  let {
    intervals = $bindable(),
    intervalRef = $bindable(),
    keyRoot = $bindable(),
    keyQuality = $bindable(),
    direction = $bindable()
  }: Props = $props();

  function toggle(i: Interval) {
    intervals = intervals.includes(i) ? intervals.filter(x => x !== i) : [...intervals, i];
  }
</script>

<div class="row">
  <span class="label">Intervals</span>
  <div class="chips" role="group" aria-label="Intervals">
    {#each INTERVAL_ORDER as i}
      <button
        type="button"
        class="chip"
        class:chip-active={intervals.includes(i)}
        aria-pressed={intervals.includes(i)}
        onclick={() => toggle(i)}
      >{i}</button>
    {/each}
  </div>
  {#if intervals.length === 0}
    <span class="hint warn">Enable at least one interval.</span>
  {/if}
</div>
<div class="row">
  <span class="label">Measured from</span>
  <ChipGroup
    bind:value={intervalRef}
    label="Measured from"
    options={[
      { value: 'diatonic-from-note', label: 'Shown note, in key', title: 'The diatonic interval above a note of the key' },
      { value: 'from-root', label: 'Key root, chromatic', title: 'b3, #4, b7… above the key root' }
    ]}
  />
</div>
<div class="row">
  <span class="label">Key</span>
  <NotePicker bind:value={keyRoot} label="Key" randomLabel="Random" />
</div>
{#if intervalRef === 'diatonic-from-note'}
  <div class="row">
    <span class="label">Key quality</span>
    <ChipGroup
      bind:value={keyQuality}
      label="Key quality"
      options={[
        { value: 'major', label: 'Major' },
        { value: 'minor', label: 'Minor' },
        { value: 'random', label: 'Random' }
      ]}
    />
  </div>
{/if}
<div class="row">
  <span class="label">Direction</span>
  <ChipGroup
    bind:value={direction}
    label="Direction"
    options={[
      { value: 'nearest', label: 'Nearest', title: 'Either way' },
      { value: 'ascending', label: 'Ascending', title: 'Higher pitch' }
    ]}
  />
</div>

<style>
  .hint.warn { color: #e07a5f; opacity: 1; }
</style>
