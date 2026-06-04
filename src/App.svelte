<script lang="ts">
  import StartScreen from './lib/components/StartScreen.svelte';
  import SessionScreen from './lib/components/SessionScreen.svelte';
  import ReportScreen from './lib/components/ReportScreen.svelte';
  import type { RootNotesConfig, RootNotesReport } from './lib/exercise/rootNotes/types';
  import { parseHash, sessionHash, START_HASH } from './lib/routing/hash';

  type Screen = 'start' | 'session' | 'report';

  // Initialize from URL synchronously so the right screen renders on first
  // paint — no start-screen flash when the URL points at a session.
  const initialRoute = parseHash(window.location.hash);

  let screen = $state<Screen>(initialRoute.screen === 'session' ? 'session' : 'start');
  let activeConfig = $state<RootNotesConfig | null>(
    initialRoute.screen === 'session' ? initialRoute.config : null
  );
  let activeReport = $state<RootNotesReport | null>(null);

  // Normalize the URL when we landed on start (either empty hash or invalid
  // session params). Use replaceState so we don't push a junk entry.
  if (initialRoute.screen === 'start' && window.location.hash !== START_HASH) {
    window.history.replaceState(null, '', START_HASH);
  }

  // Browser back / forward: derive screen+config from the new hash. Any
  // change to the session URL restarts the session (we lose report state),
  // which is acceptable per the routing contract.
  $effect(() => {
    function onHashChange() {
      const route = parseHash(window.location.hash);
      if (route.screen === 'session') {
        activeReport = null;
        // Fresh object reference triggers the {#key} remount of SessionScreen.
        activeConfig = { ...route.config };
        screen = 'session';
      } else {
        activeConfig = null;
        activeReport = null;
        screen = 'start';
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  function handleStart(config: RootNotesConfig) {
    // Setting location.hash pushes a new history entry and fires hashchange,
    // which updates state. Update state directly too so the transition is
    // synchronous (hashchange is async).
    activeConfig = config;
    activeReport = null;
    screen = 'session';
    const target = sessionHash(config);
    if (window.location.hash !== target) {
      window.location.hash = target;
    }
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
    activeConfig = { ...activeConfig };
    screen = 'session';
  }

  function handleBack() {
    activeConfig = null;
    activeReport = null;
    screen = 'start';
    if (window.location.hash !== START_HASH) {
      window.location.hash = START_HASH;
    }
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
