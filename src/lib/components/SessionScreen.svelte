<script lang="ts">
  import RootNotesBody from './RootNotesBody.svelte';
  import type { RootNotesConfig, RootNotesReport } from '../exercise/rootNotes/types';

  type Props = {
    config: RootNotesConfig;
    onComplete: (report: RootNotesReport) => void;
    onAbort: (report: RootNotesReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();
</script>

<RootNotesBody {config} {onComplete} {onAbort} />
