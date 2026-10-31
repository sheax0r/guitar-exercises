<script lang="ts">
  import HomeScreen from './lib/components/HomeScreen.svelte';
  import IdeateScreen from './lib/components/IdeateScreen.svelte';
  import SectionNav from './lib/components/SectionNav.svelte';
  import StartScreen from './lib/components/StartScreen.svelte';
  import SessionScreen from './lib/components/SessionScreen.svelte';
  import ReportScreen from './lib/components/ReportScreen.svelte';
  import type { AnyConfig, AnyReport } from './lib/exercise/config';
  import { parseHash, sessionHash, canonicalHash, LEARN_HASH, type Route } from './lib/routing/hash';

  type Screen = 'home' | 'learn' | 'ideate' | 'session' | 'report';

  // Rewrite the URL to the route's canonical hash (legacy #/session links,
  // invalid session params, unknown paths). replaceState, so no junk entry.
  function normalizeUrl(route: Route) {
    const target = canonicalHash(route);
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target);
    }
  }

  // Initialize from URL synchronously so the right screen renders on first
  // paint — no start-screen flash when the URL points at a session.
  const initialRoute = parseHash(window.location.hash);
  normalizeUrl(initialRoute);

  let screen = $state<Screen>(initialRoute.screen);
  let activeConfig = $state<AnyConfig | null>(
    initialRoute.screen === 'session' ? initialRoute.config : null
  );
  let activeReport = $state<AnyReport | null>(null);

  // Browser back / forward and nav links: derive screen+config from the new
  // hash. Any change to the session URL restarts the session (we lose report
  // state), which is acceptable per the routing contract.
  $effect(() => {
    function onHashChange() {
      const route = parseHash(window.location.hash);
      normalizeUrl(route);
      activeReport = null;
      if (route.screen === 'session') {
        // Fresh object reference triggers the {#key} remount of SessionScreen.
        activeConfig = { ...route.config };
      } else {
        activeConfig = null;
      }
      screen = route.screen;
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  });

  function handleStart(config: AnyConfig) {
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

  function handleComplete(report: AnyReport) {
    activeReport = report;
    screen = 'report';
  }

  function handleAbort(report: AnyReport) {
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
    screen = 'learn';
    if (window.location.hash !== LEARN_HASH) {
      window.location.hash = LEARN_HASH;
    }
  }
</script>

<!-- Hidden during a running session: a stray tap would abandon it. -->
{#if screen !== 'session'}
  <SectionNav section={screen === 'ideate' ? 'ideate' : screen === 'home' ? null : 'learn'} />
{/if}

{#if screen === 'home'}
  <HomeScreen />
{:else if screen === 'learn'}
  <StartScreen onStart={handleStart} />
{:else if screen === 'ideate'}
  <IdeateScreen />
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
