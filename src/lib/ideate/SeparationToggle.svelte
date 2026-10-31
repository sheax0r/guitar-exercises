<script lang="ts">
  // Source separation: isolate one stem (Demucs) before transcribing a mixed recording.
  import { settings } from './state.svelte';
  import ChipGroup from '../components/start/ChipGroup.svelte';
</script>

<div class="row">
  <label class="label"><input type="checkbox" bind:checked={settings.sep} /> Source separation</label>
  {#if settings.sep}
    <ChipGroup
      bind:value={settings.stem}
      label="Stem to isolate"
      options={[
        { value: 'other', label: 'Other (gtr / keys)' },
        { value: 'vocals', label: 'Vocals' },
        { value: 'bass', label: 'Bass' },
        { value: 'drums', label: 'Drums' }
      ]}
    />
  {/if}
  <span class="hint">Isolate one stem of a full mix before transcribing. ~172 MB model on first use, slow (minutes per song).</span>
</div>
