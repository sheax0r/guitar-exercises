<script lang="ts">
  import StartScreen from './lib/components/StartScreen.svelte';
  import SessionScreen from './lib/components/SessionScreen.svelte';
  import ReportScreen from './lib/components/ReportScreen.svelte';
  import type { RootNotesConfig, RootNotesReport } from './lib/exercise/rootNotes/types';

  type Screen = 'start' | 'session' | 'report';

  let screen = $state<Screen>('start');
  let activeConfig = $state<RootNotesConfig | null>(null);
  let activeReport = $state<RootNotesReport | null>(null);

  function handleStart(config: RootNotesConfig) {
    activeConfig = config;
    activeReport = null;
    screen = 'session';
  }

  function handleComplete(report: RootNotesReport) {
    activeReport = report;
    screen = 'report';
  }

  function handleAbort(report: RootNotesReport) {
    activeReport = report;
    screen = 'report';
  }

  function handlePracticeAgain() {
    if (!activeConfig) return;
    activeReport = null;
    // Re-assign with a shallow copy to trigger the {#key} remount of SessionScreen.
    activeConfig = { ...activeConfig };
    screen = 'session';
  }

  function handleBack() {
    activeConfig = null;
    activeReport = null;
    screen = 'start';
  }
</script>

{#if screen === 'start'}
  <StartScreen onStart={handleStart} />
{:else if screen === 'session' && activeConfig}
  {#key activeConfig}
    <SessionScreen
      config={activeConfig}
      onComplete={handleComplete}
      onAbort={handleAbort}
    />
  {/key}
{:else if screen === 'report' && activeReport && activeConfig}
  <ReportScreen
    report={activeReport}
    config={activeConfig}
    onPracticeAgain={handlePracticeAgain}
    onBack={handleBack}
  />
{/if}
