<script lang="ts">
  import RootNotesBody from './RootNotesBody.svelte';
  import PlayShapeBody from './PlayShapeBody.svelte';
  import type { AnyConfig, AnyReport } from '../exercise/config';

  type Props = {
    config: AnyConfig;
    onComplete: (report: AnyReport) => void;
    onAbort: (report: AnyReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();
</script>

{#if config.exercise === 'root-notes' || config.exercise === 'random-roots'}
  <RootNotesBody {config} {onComplete} {onAbort} />
{:else if config.exercise === 'play-shape'}
  <PlayShapeBody {config} {onComplete} {onAbort} />
{/if}
