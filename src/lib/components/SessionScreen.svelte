<script lang="ts">
  import FretboardSession from './FretboardSession.svelte';
  import PlayShapeBody from './PlayShapeBody.svelte';
  import IdentifyModeBody from './IdentifyModeBody.svelte';
  import CagedBody from './CagedBody.svelte';
  import DegreesBody from './DegreesBody.svelte';
  import FindAllBody from './FindAllBody.svelte';
  import type { AnyConfig, AnyReport } from '../exercise/config';

  type Props = {
    config: AnyConfig;
    onComplete: (report: AnyReport) => void;
    onAbort: (report: AnyReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();
</script>

{#if config.exercise === 'play-shape'}
  <PlayShapeBody {config} {onComplete} {onAbort} />
{:else if (config.exercise === 'root-notes' || config.exercise === 'random-roots') && config.rootVariant === 'find-all'}
  <FindAllBody {config} {onComplete} {onAbort} />
{:else if config.exercise === 'degrees'}
  <DegreesBody {config} {onComplete} {onAbort} />
{:else if config.exercise === 'caged'}
  <CagedBody {config} {onComplete} {onAbort} />
{:else if config.exercise === 'identify-mode'}
  <IdentifyModeBody {config} {onComplete} {onAbort} />
{:else}
  <FretboardSession {config} {onComplete} {onAbort} />
{/if}
