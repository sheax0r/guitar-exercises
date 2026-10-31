<script lang="ts">
  import type { Note, Direction } from '../../music/notes';
  import type { Interval, ScaleQuality } from '../../music/scales';
  import ChipGroup from './ChipGroup.svelte';
  import NotePicker from './NotePicker.svelte';

  type Props = {
    intervalKind: Interval | 'random'; // $bindable
    keyRoot: Note | 'random';          // $bindable
    keyQuality: ScaleQuality | 'random'; // $bindable
    direction: Direction;              // $bindable
  };
  let {
    intervalKind = $bindable(),
    keyRoot = $bindable(),
    keyQuality = $bindable(),
    direction = $bindable()
  }: Props = $props();
</script>

<div class="row">
  <span class="label">Interval</span>
  <ChipGroup
    bind:value={intervalKind}
    label="Interval"
    options={[
      { value: '3rd', label: '3rd' },
      { value: '5th', label: '5th' },
      { value: 'random', label: 'Random' }
    ]}
  />
</div>
<div class="row">
  <span class="label">Key</span>
  <NotePicker bind:value={keyRoot} label="Key" randomLabel="Random" />
</div>
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
