<script lang="ts">
  import { untrack, type Snippet } from 'svelte';

  type Props = {
    durationSec: number;
    continuous: boolean;
    correctCount: number;
    incorrectCount: number;
    // Study-mode pause contributed by the body (e.g. Root Notes "Show roots").
    // ORed with the shell's own manual/spacebar pause.
    studyPaused?: boolean;
    // Called when the session ends: soft=true means time ran out / completed,
    // soft=false means the player aborted. The body turns this into a report.
    onEnd: (soft: boolean) => void;
    // Called on resume with how long the pause lasted, so the body can shift
    // its exercise's prompt timer forward.
    onResume?: (pauseMs: number) => void;
    headerExtra?: Snippet;
    children: Snippet;
    // Combined pause state (manual/spacebar OR studyPaused), surfaced to the
    // body so its board overlay and click handlers can read it.
    paused?: boolean;
  };

  let {
    durationSec,
    continuous,
    correctCount,
    incorrectCount,
    studyPaused = false,
    onEnd,
    onResume,
    headerExtra,
    children,
    paused = $bindable(false)
  }: Props = $props();

  let remainingSec = $state(untrack(() => durationSec));
  let elapsedSec = $state(0);
  let ended = $state(false);
  let pausedManually = $state(false);
  let pauseStartedAt: number | null = null;

  // Keep the bound-out `paused` in sync with the combined internal state.
  $effect(() => {
    paused = pausedManually || studyPaused;
  });

  let sessionStartedAt = Date.now();
  let tickHandle: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    tickHandle = setInterval(() => {
      if (ended || paused) return;
      const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
      elapsedSec = elapsed;
      if (!continuous) {
        remainingSec = Math.max(0, durationSec - elapsed);
        if (remainingSec <= 0) finish(true);
      }
    }, 250);
    return () => {
      if (tickHandle !== null) clearInterval(tickHandle);
    };
  });

  // Intercept tab close / refresh mid-session so progress isn't lost.
  $effect(() => {
    if (ended) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  });

  // Spacebar toggles pause unless focus is on a native control.
  $effect(() => {
    if (ended) return;
    function handler(e: KeyboardEvent) {
      if (e.key !== ' ' && e.code !== 'Space') return;
      if (e.target instanceof Element && e.target.closest('button, input, label, select, textarea, a')) return;
      e.preventDefault();
      togglePause();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Pause-start / resume accounting for both pause sources.
  $effect(() => {
    if (ended) return;
    if (paused) {
      if (pauseStartedAt === null) pauseStartedAt = Date.now();
    } else if (pauseStartedAt !== null) {
      const pauseDurationMs = Date.now() - pauseStartedAt;
      sessionStartedAt += pauseDurationMs;
      onResume?.(pauseDurationMs);
      pauseStartedAt = null;
    }
  });

  function togglePause() {
    if (ended) return;
    pausedManually = !pausedManually;
  }

  function finish(soft: boolean) {
    if (ended) return;
    ended = true;
    if (tickHandle !== null) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
    onEnd(soft);
  }

  function confirmAndAbort() {
    if (ended) return;
    if (window.confirm('End the session now? Stats so far will be shown.')) {
      finish(false);
    }
  }

  function mmss(s: number): string {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }
</script>

<div class="session">
  <header>
    {@render headerExtra?.()}
    <div class="timer">
      {#if continuous}
        ⏱ {mmss(elapsedSec)}
      {:else}
        {mmss(remainingSec)}
      {/if}
    </div>
    <div class="tally">
      <span class="ok">✓ {correctCount}</span>
      <span class="bad">✗ {incorrectCount}</span>
    </div>
    <button class="pause-btn" onclick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
    <button onclick={confirmAndAbort}>End session</button>
  </header>

  {@render children()}
</div>

<style>
  .session { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  header {
    display: flex; align-items: center; gap: 24px; justify-content: space-between;
    padding: 12px 16px; background: rgba(0,0,0,0.15); border-radius: 8px;
    flex-wrap: wrap;
  }
  .timer { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tally { display: flex; gap: 12px; font-size: 16px; }
  /* Fixed width so swapping "Pause"/"Resume" doesn't shift the header row. */
  .pause-btn { min-width: 6em; }
  .ok { color: #5fb35a; }
  .bad { color: #e07a5f; }
</style>
