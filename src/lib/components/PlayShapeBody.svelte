<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import { PlayShapeExercise } from '../exercise/modes/PlayShapeExercise';
  import type { PlayShapeConfig, PlayShapePrompt, ModesReport, Pos } from '../exercise/modes/types';
  import { noteAt } from '../music/notes';
  import { MODE_DISPLAY } from '../music/modes';
  import { playPluck } from '../audio/pluck';

  type Props = {
    config: PlayShapeConfig;
    onComplete: (report: ModesReport) => void;
    onAbort: (report: ModesReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new PlayShapeExercise();
  untrack(() => exercise.start(config));

  let currentPrompt = $state<PlayShapePrompt | null>(null);
  let litCorrect = $state<Pos[]>([]);
  let wrongFlash = $state<Pos | null>(null);
  let hintPositions = $state<Pos[]>([]);
  let awaitingAdvance = $state(false);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let promptHadWrong = false;

  let showFretNumbers = $state(untrack(() => config.showFretNumbers));
  let paused = $state(false);

  function endSession(soft: boolean) {
    const report = exercise.getReport();
    if (soft) onComplete(report);
    else onAbort(report);
  }

  // Click anywhere off the fretboard to advance once the shape is complete.
  $effect(() => {
    if (!awaitingAdvance || paused) return;
    function handler(e: MouseEvent) {
      if (!awaitingAdvance || paused) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-role="hit"]')) return;
      if (e.target.closest('button, input, label, select, textarea, a')) return;
      nextPrompt();
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  });

  function nextPrompt() {
    litCorrect = [];
    wrongFlash = null;
    hintPositions = [];
    awaitingAdvance = false;
    promptHadWrong = false;
    currentPrompt = exercise.getNextPrompt();
  }

  nextPrompt();

  function handleSelect(pos: Pos) {
    if (paused) return;
    if (awaitingAdvance) {
      nextPrompt();
      return;
    }
    if (!currentPrompt) return;

    if (config.playSound) {
      try { playPluck(pos.string, pos.fret); } catch { /* ignore */ }
    }

    const result = exercise.submitAnswer(pos);

    if (result.correct) {
      litCorrect = [...litCorrect, pos];
      wrongFlash = null;
      hintPositions = [];
    } else {
      promptHadWrong = true;
      wrongFlash = pos;
      // For the ordered octave run, point to the expected next position.
      hintPositions = currentPrompt.variant === 'octave' ? result.correctAnswers : [];
    }

    if (result.promptComplete) {
      if (promptHadWrong) incorrectCount += 1;
      else correctCount += 1;
      awaitingAdvance = true;
      wrongFlash = null;
      hintPositions = [];
    }
  }

  const highlights = $derived<Highlight[]>(
    paused
      ? []
      : (() => {
          if (!currentPrompt) return [];
          const litKeys = new Set(litCorrect.map(p => `${p.string}-${p.fret}`));
          const out: Highlight[] = [];
          // Root marker (unless already clicked correct).
          if (!litKeys.has(`${currentPrompt.root.string}-${currentPrompt.root.fret}`)) {
            out.push({
              string: currentPrompt.root.string,
              fret: currentPrompt.root.fret,
              note: currentPrompt.rootNote,
              kind: 'scale-root'
            });
          }
          for (const p of litCorrect) {
            out.push({ string: p.string, fret: p.fret, note: noteAt(p.string, p.fret), kind: 'user-correct' });
          }
          for (const p of hintPositions) {
            out.push({ string: p.string, fret: p.fret, note: noteAt(p.string, p.fret), kind: 'closest-from-click' });
          }
          if (wrongFlash) {
            out.push({ string: wrongFlash.string, fret: wrongFlash.fret, note: noteAt(wrongFlash.string, wrongFlash.fret), kind: 'user-wrong' });
          }
          return out;
        })()
  );

  const modeLabel = $derived(currentPrompt ? MODE_DISPLAY[currentPrompt.mode] : '');
</script>

<SessionShell
  durationSec={config.durationSec}
  continuous={config.continuous}
  {correctCount}
  {incorrectCount}
  onEnd={endSession}
  onResume={(ms) => exercise.notifyResumed(ms)}
  bind:paused
>
  {#snippet headerExtra()}
    <div class="target">
      <strong>{modeLabel}</strong> from {currentPrompt?.rootNote}
    </div>
    <div class="progress">{litCorrect.length} / {currentPrompt?.expectedCount ?? 0}</div>
    <label class="toggle">
      <input type="checkbox" bind:checked={showFretNumbers} />
      Fret numbers
    </label>
  {/snippet}

  <div class="board" class:paused={paused}>
    <Fretboard
      maxFret={config.maxFret}
      fretNumbersVisible={showFretNumbers}
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
    <div class="continue-hint">Shape complete — click anywhere to continue →</div>
  {/if}
</SessionShell>

<style>
  .target { font-size: 22px; }
  .progress { font-size: 18px; font-variant-numeric: tabular-nums; opacity: 0.85; }
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
