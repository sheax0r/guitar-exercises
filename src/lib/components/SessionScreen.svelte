<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import { RootNotesExercise } from '../exercise/rootNotes/RootNotesExercise';
  import type { RootNotesConfig, RootNotesPrompt, RootNotesReport } from '../exercise/rootNotes/types';
  import type { StringNum } from '../music/tuning';
  import { noteAt, closestPositionOf, type Fret } from '../music/notes';
  import { playPluck } from '../audio/pluck';

  type Props = {
    config: RootNotesConfig;
    onComplete: (report: RootNotesReport) => void;
    onAbort: (report: RootNotesReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  // A session locks in its configuration for its lifetime: when it starts we
  // snapshot the initial config and run with it until the session ends. Wrap
  // the top-level reads in untrack() to make that intent explicit and silence
  // state_referenced_locally — we deliberately do NOT want these reads to be
  // reactive.
  const exercise = new RootNotesExercise();
  untrack(() => exercise.start(config));

  let currentPrompt = $state<RootNotesPrompt | null>(null);
  let awaitingAdvance = $state(false);
  let flashHighlights = $state<Highlight[]>([]);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let remainingSec = $state(untrack(() => config.durationSec));
  let elapsedSec = $state(0);
  let sessionEnded = $state(false);
  let pausedManually = $state(false);
  let pauseStartedAt: number | null = null;
  let showRootMarkers = $state(untrack(() => config.showRootMarkers));
  // Fret numbers are an orientation aid, not a study cheat, so toggling them
  // does NOT pause the session the way "Show roots" does.
  let showFretNumbers = $state(untrack(() => config.showFretNumbers));

  // Toggling "Show roots" pauses the session — it's a study mode, not a
  // testing mode, so we shouldn't be timing or quizzing while it's on.
  const paused = $derived(pausedManually || showRootMarkers);

  // sessionStartedAt is shifted forward by pause durations on resume so the
  // displayed elapsed/remaining timers exclude paused time.
  let sessionStartedAt = Date.now();
  let tickHandle: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    tickHandle = setInterval(() => {
      if (sessionEnded || paused) return;
      const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
      elapsedSec = elapsed;
      if (!config.continuous) {
        remainingSec = Math.max(0, config.durationSec - elapsed);
      }
    }, 250);
    return () => {
      if (tickHandle !== null) clearInterval(tickHandle);
    };
  });

  // While a session is running, intercept tab close / back nav / refresh so
  // the user doesn't lose progress mid-test. The browser shows its own native
  // "Leave site?" dialog — text is not customizable.
  $effect(() => {
    if (sessionEnded) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  });

  // While awaiting advance, a click anywhere OFF the fretboard advances to
  // the next prompt. Clicks on the fretboard hit-rects go through the rect's
  // own onclick → handleSelect, which already handles the advance branch —
  // skipping them here also prevents the answer-submit click from immediately
  // re-triggering this handler via bubbling once the effect arms it.
  $effect(() => {
    if (!awaitingAdvance || sessionEnded || paused) return;
    function handler(e: MouseEvent) {
      if (!awaitingAdvance || paused) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-role="hit"]')) return;
      // Don't hijack clicks on interactive controls (End session button,
      // Show roots toggle, anything else with native click semantics).
      if (e.target.closest('button, input, label, select, textarea, a')) return;
      awaitingAdvance = false;
      flashHighlights = [];
      nextPrompt();
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  });

  // Spacebar toggles pause while a session is active. We ignore the key when
  // focus is on a native interactive control so it can still activate buttons
  // and toggle checkboxes the usual way.
  $effect(() => {
    if (sessionEnded) return;
    function handler(e: KeyboardEvent) {
      if (e.key !== ' ' && e.code !== 'Space') return;
      if (e.target instanceof Element && e.target.closest('button, input, label, select, textarea, a')) return;
      e.preventDefault();
      togglePause();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // A single $effect handles pause-start/resume accounting so it works for
  // BOTH pause sources (manual button/space and the Show-roots toggle).
  // When we enter pause we record the start; when we leave pause we shift
  // sessionStartedAt and the exercise's prompt timer forward by the pause
  // duration so paused time doesn't count against the player.
  $effect(() => {
    if (sessionEnded) return;
    if (paused) {
      if (pauseStartedAt === null) pauseStartedAt = Date.now();
    } else if (pauseStartedAt !== null) {
      const pauseDurationMs = Date.now() - pauseStartedAt;
      sessionStartedAt += pauseDurationMs;
      exercise.notifyResumed(pauseDurationMs);
      pauseStartedAt = null;
    }
  });

  function togglePause() {
    if (sessionEnded) return;
    pausedManually = !pausedManually;
  }

  function endSession(soft: boolean) {
    if (sessionEnded) return;
    sessionEnded = true;
    if (tickHandle !== null) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
    const report = exercise.getReport();
    if (soft) onComplete(report);
    else onAbort(report);
  }

  function buildPromptHighlight(): Highlight[] {
    if (!currentPrompt) return [];
    return [{
      string: currentPrompt.highlight.string,
      fret: currentPrompt.highlight.fret,
      note: currentPrompt.highlightNote,
      kind: 'prompt'
    }];
  }

  function nextPrompt() {
    if (sessionEnded) return;
    if (!config.continuous && remainingSec <= 0) {
      endSession(true);
      return;
    }
    flashHighlights = [];
    awaitingAdvance = false;
    currentPrompt = exercise.getNextPrompt();
  }

  nextPrompt();

  function handleSelect(pos: { string: StringNum; fret: Fret }) {
    if (sessionEnded || paused) return;
    // While awaiting advance, any fretboard click advances to the next prompt.
    if (awaitingAdvance) {
      awaitingAdvance = false;
      flashHighlights = [];
      nextPrompt();
      return;
    }
    if (!currentPrompt) return;
    const promptTarget = currentPrompt.targetNote;

    if (config.playSound) {
      try { playPluck(pos.string, pos.fret); } catch { /* ignore */ }
    }

    const result = exercise.submitAnswer(pos);

    if (result.correct) {
      correctCount += 1;
      flashHighlights = [
        ...buildPromptHighlight(),
        {
          string: pos.string,
          fret: pos.fret,
          note: noteAt(pos.string, pos.fret),
          kind: 'user-correct'
        }
      ];
    } else {
      incorrectCount += 1;
      const correctFlashes: Highlight[] = result.correctAnswers.map(c => ({
        string: c.string,
        fret: c.fret,
        note: noteAt(c.string, c.fret),
        kind: 'correct-flash'
      }));
      // If the player clicked a note that isn't the target at all, also show
      // the closest target-note position relative to their click, rendered in
      // the root-marker style so it reads as orientation rather than the
      // "real" correct answer.
      const clickedNote = noteAt(pos.string, pos.fret);
      const fromClick: Highlight[] = clickedNote === promptTarget
        ? []
        : closestPositionOf(promptTarget, pos, config.maxFret, config.algorithm).map(c => ({
            string: c.string,
            fret: c.fret,
            note: noteAt(c.string, c.fret),
            kind: 'closest-from-click' as const
          }));
      flashHighlights = [
        ...buildPromptHighlight(),
        {
          string: pos.string,
          fret: pos.fret,
          note: clickedNote,
          kind: 'user-wrong'
        },
        ...correctFlashes,
        ...fromClick
      ];
      if (config.playSound) {
        const first = result.correctAnswers[0];
        try { playPluck(first.string, first.fret); } catch { /* ignore */ }
      }
    }

    awaitingAdvance = true;
  }

  const highlights = $derived<Highlight[]>(
    paused ? [] : (flashHighlights.length > 0 ? flashHighlights : buildPromptHighlight())
  );

  // The note to find for the current prompt. For 'random-roots' this changes
  // every prompt, so we read it from the prompt rather than config.targetNote.
  // Falls back to config.targetNote only in the brief window before the first
  // prompt is generated.
  const currentTarget = $derived(currentPrompt?.targetNote ?? config.targetNote);

  function confirmAndAbort() {
    if (sessionEnded) return;
    if (window.confirm('End the session now? Stats so far will be shown.')) {
      endSession(false);
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
    <div class="target">Target: <strong>{currentTarget}</strong></div>
    <div class="timer">
      {#if config.continuous}
        ⏱ {mmss(elapsedSec)}
      {:else}
        {mmss(remainingSec)}
      {/if}
    </div>
    <div class="tally">
      <span class="ok">✓ {correctCount}</span>
      <span class="bad">✗ {incorrectCount}</span>
    </div>
    <label class="toggle">
      <input type="checkbox" bind:checked={showRootMarkers} />
      Show roots
    </label>
    <label class="toggle">
      <input type="checkbox" bind:checked={showFretNumbers} />
      Fret numbers
    </label>
    <button class="pause-btn" onclick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
    <button onclick={confirmAndAbort}>End session</button>
  </header>

  <div class="board" class:paused={pausedManually && !showRootMarkers}>
    <Fretboard
      maxFret={config.maxFret}
      labelsVisible={config.showAllLabels}
      fretNumbersVisible={showFretNumbers}
      targetHighlightNote={currentTarget}
      showRootMarkers={showRootMarkers}
      highlights={highlights}
      onSelect={handleSelect}
    />
    {#if paused}
      <div class="paused-overlay">
        <div class="paused-text">Paused</div>
        <div class="paused-hint">Press space or click Resume</div>
      </div>
    {/if}
  </div>

  {#if awaitingAdvance && !paused}
    <div class="continue-hint">Click anywhere to continue →</div>
  {/if}
</div>

<style>
  .session { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  header {
    display: flex; align-items: center; gap: 24px; justify-content: space-between;
    padding: 12px 16px; background: rgba(0,0,0,0.15); border-radius: 8px;
  }
  .target { font-size: 22px; }
  .timer { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tally { display: flex; gap: 12px; font-size: 16px; }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    cursor: pointer;
    user-select: none;
  }
  /* Fixed width so the label swapping between "Pause" and "Resume" doesn't
     resize the button and shift the rest of the header row. */
  .pause-btn { min-width: 6em; }
  .ok { color: #5fb35a; }
  .bad { color: #e07a5f; }
  .board {
    background: #2a2018;
    padding: 20px;
    border-radius: 8px;
    position: relative;
  }
  .board.paused :global(.fretboard) { filter: blur(2px) brightness(0.6); }
  .paused-overlay {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; border-radius: 8px;
    background: rgba(0, 0, 0, 0.35);
    pointer-events: none;
  }
  .paused-text {
    font-size: 48px; font-weight: 700; letter-spacing: 0.05em;
    color: rgba(232, 227, 211, 0.7); text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
  .paused-hint { font-size: 14px; opacity: 0.8; color: #cfc6b3; }
  .continue-hint {
    text-align: center;
    font-size: 14px;
    opacity: 0.7;
    padding: 8px;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
