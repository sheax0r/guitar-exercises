<script lang="ts">
  // Test-only wrapper: exposes DurationPicker's bound values in the DOM.
  import DurationPicker from './DurationPicker.svelte';
  let { durationSec = 300, continuous = false }: { durationSec?: number; continuous?: boolean } = $props();
</script>

<DurationPicker bind:durationSec bind:continuous />
<output data-testid="state">{durationSec}|{continuous}</output>
