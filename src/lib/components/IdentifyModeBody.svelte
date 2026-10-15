<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import { IdentifyModeExercise } from '../exercise/modes/IdentifyModeExercise';
  import type { IdentifyModeConfig, IdentifyModePrompt, ModesReport } from '../exercise/modes/types';
  import { noteAt } from '../music/notes';
  import { MODE_DISPLAY, MODE_ORDER, type Mode } from '../music/modes';

  type Props = {
    config: IdentifyModeConfig;
    onComplete: (report: ModesReport) => void;
    onAbort: (report: ModesReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new IdentifyModeExercise();
  untrack(() => exercise.start(config));

  // Mode buttons, shown in canonical display order, limited to enabled modes.
  const choices = untrack(() => MODE_ORDER.filter(m => config.enabledModes.includes(m)));

  let currentPrompt = $state<IdentifyModePrompt | null>(null);
  let answered = $state<Mode | null>(null);
  let answerCorrect = $state<boolean | null>(null);
  let revealedMode = $state<Mode | null>(null);
  let awaitingAdvance = $state(false);
  let correctCount = $state(0);
  let incorrectCount = $state(0);

  let showFretNumbers = $state(untrack(() => config.showFretNumbers));
  let paused = $state(false);

  function endSession(soft: boolean) {
    const report = exercise.getReport();
    if (soft) onComplete(report);
    else onAbort(report);
  }

  // Click anywhere (off the mode buttons) to advance after answering.
  $effect(() => {
    if (!awaitingAdvance || paused) return;
    function handler(e: MouseEvent) {
      if (!awaitingAdvance || paused) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('button, input, label, select, textarea, a')) return;
      nextPrompt();
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  });

  function nextPrompt() {
    answered = null;
    answerCorrect = null;
    revealedMode = null;
    awaitingAdvance = false;
    currentPrompt = exercise.getNextPrompt();
  }

  nextPrompt();

  function pick(m: Mode) {
    if (paused || awaitingAdvance || answered) return;
    const result = exercise.submitAnswer({ mode: m });
    answered = m;
    answerCorrect = result.correct;
    revealedMode = result.correctAnswers[0].mode;
    if (result.correct) correctCount += 1;
    else incorrectCount += 1;
    awaitingAdvance = true;
  }

  const highlights = $derived<Highlight[]>(
    paused || !currentPrompt
      ? []
      : (() => {
          const rootKeys = new Set(currentPrompt.rootPositions.map(p => `${p.string}-${p.fret}`));
          return currentPrompt.positions.map(p => ({
            string: p.string,
            fret: p.fret,
            note: noteAt(p.string, p.fret),
            kind: rootKeys.has(`${p.string}-${p.fret}`) ? ('scale-root' as const) : ('scale-note' as const)
          }));
        })()
  );

  function buttonClass(m: Mode): string {
    if (!answered) return '';
    if (m === revealedMode) return 'right';
    if (m === answered && !answerCorrect) return 'wrong';
    return '';
  }
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
    <div class="target">Which mode? Root: <strong>{currentPrompt?.rootNote}</strong></div>
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
    />
    {#if paused}
      <div class="paused-overlay">
        <div class="paused-text">Paused</div>
        <div class="paused-hint">Press space or click Resume</div>
      </div>
    {/if}
  </div>

  {#if !paused}
    <div class="choices">
      {#each choices as m}
        <button
          type="button"
          class="choice {buttonClass(m)}"
          disabled={answered !== null}
          onclick={() => pick(m)}
        >{MODE_DISPLAY[m]}</button>
      {/each}
    </div>
  {/if}

  {#if awaitingAdvance && !paused}
    <div class="continue-hint">
      {answerCorrect ? 'Correct' : `It was ${revealedMode ? MODE_DISPLAY[revealedMode] : ''}`} — click anywhere to continue →
    </div>
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
  .choices { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  .choice {
    padding: 12px 20px; font-size: 16px; border-radius: 8px;
    border: 1px solid #888; background: transparent; color: inherit; cursor: pointer;
  }
  .choice:disabled { cursor: default; }
  .choice.right { background: #5fb35a; color: #0a0a0a; border-color: #5fb35a; font-weight: 700; }
  .choice.wrong { background: #d65a3d; color: #0a0a0a; border-color: #d65a3d; font-weight: 700; }
  .continue-hint {
    text-align: center; font-size: 14px; opacity: 0.7; padding: 8px;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
