<script lang="ts">
  import type { Note } from '../../music/notes';
  import NotePicker from './NotePicker.svelte';

  type Props = {
    target: Note | 'random'; // $bindable; 'random' ↔ random-roots exercise
  };
  let { target = $bindable() }: Props = $props();
</script>

<div class="row">
  <span class="label">Target note</span>
  <NotePicker bind:value={target} label="Target note" randomLabel="A/E/D" />
  {#if target === 'random'}
    <span class="hint">A/E/D picks one of A, E, D each prompt.</span>
  {/if}
</div>
