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
  let showRootMarkers = $state(untrack(() => config.showRootMarkers));

  const sessionStartedAt = Date.now();
  let tickHandle: ReturnType<typeof setInterval> | null = null;

  $effect(() => {
    tickHandle = setInterval(() => {
      if (sessionEnded) return;
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

  // While awaiting advance, a click anywhere on the page (not just a fret)
  // proceeds to the next prompt. Clicks on the fretboard hit-rects still
  // trigger handleSelect's awaitingAdvance branch first, which flips the
  // flag false before this bubble-phase listener reads it — so the rect
  // path and the document path can't double-advance.
  $effect(() => {
    if (!awaitingAdvance || sessionEnded) return;
    function handler(e: MouseEvent) {
      if (!awaitingAdvance) return;
      if (!(e.target instanceof Element)) return;
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
    if (sessionEnded) return;
    // While awaiting advance, any fretboard click advances to the next prompt.
    if (awaitingAdvance) {
      awaitingAdvance = false;
      flashHighlights = [];
      nextPrompt();
      return;
    }
    if (!currentPrompt) return;

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
      const fromClick: Highlight[] = clickedNote === config.targetNote
        ? []
        : closestPositionOf(config.targetNote, pos, config.maxFret, config.algorithm).map(c => ({
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
    flashHighlights.length > 0 ? flashHighlights : buildPromptHighlight()
  );

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
    <div class="target">Target: <strong>{config.targetNote}</strong></div>
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
    <button onclick={confirmAndAbort}>End session</button>
  </header>

  <div class="board">
    <Fretboard
      maxFret={config.maxFret}
      labelsVisible={config.showAllLabels}
      targetHighlightNote={config.targetNote}
      showRootMarkers={showRootMarkers}
      highlights={highlights}
      onSelect={handleSelect}
    />
  </div>

  {#if awaitingAdvance}
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
  .ok { color: #5fb35a; }
  .bad { color: #e07a5f; }
  .board { background: #2a2018; padding: 20px; border-radius: 8px; }
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
