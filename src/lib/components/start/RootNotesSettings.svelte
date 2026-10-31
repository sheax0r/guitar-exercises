<script lang="ts">
  import type { Note } from '../../music/notes';
  import NotePicker from './NotePicker.svelte';
  import ChipGroup from './ChipGroup.svelte';

  type Props = {
    target: Note | 'random'; // $bindable; 'random' ↔ random-roots exercise
    rootVariant: 'nearest' | 'find-all'; // $bindable
    findAllWindow: 'neck' | 'window';    // $bindable
  };
  let { target = $bindable(), rootVariant = $bindable(), findAllWindow = $bindable() }: Props = $props();
</script>

<div class="row">
  <span class="label">Target note</span>
  <NotePicker bind:value={target} label="Target note" randomLabel="A/E/D" />
  {#if target === 'random'}
    <span class="hint">A/E/D picks one of A, E, D each prompt.</span>
  {/if}
</div>
<div class="row">
  <span class="label">Drill</span>
  <ChipGroup
    bind:value={rootVariant}
    label="Drill"
    options={[
      { value: 'nearest', label: 'Nearest one' },
      { value: 'find-all', label: 'Find them all' }
    ]}
  />
</div>
{#if rootVariant === 'find-all'}
  <div class="row">
    <span class="label">Where</span>
    <ChipGroup
      bind:value={findAllWindow}
      label="Where"
      options={[
        { value: 'neck', label: 'Whole neck' },
        { value: 'window', label: '5-fret window' }
      ]}
    />
  </div>
{/if}
