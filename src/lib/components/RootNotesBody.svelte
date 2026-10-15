<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
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

  const exercise = new RootNotesExercise();
  untrack(() => exercise.start(config));

  let currentPrompt = $state<RootNotesPrompt | null>(null);
  let awaitingAdvance = $state(false);
  let flashHighlights = $state<Highlight[]>([]);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let showRootMarkers = $state(untrack(() => config.showRootMarkers));
  // Fret numbers are an orientation aid, not a study cheat, so toggling them
  // does NOT pause the session the way "Show roots" does.
  let showFretNumbers = $state(untrack(() => config.showFretNumbers));

  // Bound out of the shell: manual/spacebar pause OR the Show-roots study pause.
  let paused = $state(false);

  function endSession(soft: boolean) {
    const report = exercise.getReport();
    if (soft) onComplete(report);
    else onAbort(report);
  }

  // While awaiting advance, a click anywhere OFF the fretboard advances to the
  // next prompt. Clicks on the hit-rects go through handleSelect; skipping them
  // here also stops the answer-submit click from re-triggering via bubbling.
  $effect(() => {
    if (!awaitingAdvance || paused) return;
    function handler(e: MouseEvent) {
      if (!awaitingAdvance || paused) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-role="hit"]')) return;
      if (e.target.closest('button, input, label, select, textarea, a')) return;
      awaitingAdvance = false;
      flashHighlights = [];
      nextPrompt();
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  });

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
    flashHighlights = [];
    awaitingAdvance = false;
    currentPrompt = exercise.getNextPrompt();
  }

  nextPrompt();

  function handleSelect(pos: { string: StringNum; fret: Fret }) {
    if (paused) return;
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
        { string: pos.string, fret: pos.fret, note: noteAt(pos.string, pos.fret), kind: 'user-correct' }
      ];
    } else {
      incorrectCount += 1;
      const correctFlashes: Highlight[] = result.correctAnswers.map(c => ({
        string: c.string,
        fret: c.fret,
        note: noteAt(c.string, c.fret),
        kind: 'correct-flash'
      }));
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
        { string: pos.string, fret: pos.fret, note: clickedNote, kind: 'user-wrong' },
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

  const currentTarget = $derived(currentPrompt?.targetNote ?? config.targetNote);
</script>

<SessionShell
  durationSec={config.durationSec}
  continuous={config.continuous}
  {correctCount}
  {incorrectCount}
  studyPaused={showRootMarkers}
  onEnd={endSession}
  onResume={(ms) => exercise.notifyResumed(ms)}
  bind:paused
>
  {#snippet headerExtra()}
    <div class="target">Target: <strong>{currentTarget}</strong></div>
    <label class="toggle">
      <input type="checkbox" bind:checked={showRootMarkers} />
      Show roots
    </label>
    <label class="toggle">
      <input type="checkbox" bind:checked={showFretNumbers} />
      Fret numbers
    </label>
  {/snippet}

  <div class="board" class:paused={paused && !showRootMarkers}>
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
</SessionShell>

<style>
  .target { font-size: 22px; }
  .toggle {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 14px; cursor: pointer; user-select: none;
  }
  .board { background: #2a2018; padding: 20px; border-radius: 8px; position: relative; }
  .board.paused :global(.fretboard) { filter: blur(2px) brightness(0.6); }
  .paused-overlay {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; border-radius: 8px;
    background: rgba(0, 0, 0, 0.35); pointer-events: none;
  }
  .paused-text {
    font-size: 48px; font-weight: 700; letter-spacing: 0.05em;
    color: rgba(232, 227, 211, 0.7); text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
  .paused-hint { font-size: 14px; opacity: 0.8; color: #cfc6b3; }
  .continue-hint {
    text-align: center; font-size: 14px; opacity: 0.7; padding: 8px;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
