<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import { FindAllExercise, type FindAllPrompt } from '../exercise/FindAllExercise';
  import type { ExerciseConfig, ExerciseAnswer, ExerciseReport } from '../exercise/types';
  import { noteAt, NOTE_DISPLAY } from '../music/notes';
  import { playPluck } from '../audio/pluck';

  type Pos = ExerciseAnswer;
  type Props = {
    config: ExerciseConfig;
    onComplete: (report: ExerciseReport) => void;
    onAbort: (report: ExerciseReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new FindAllExercise();
  untrack(() => exercise.start(config));

  let currentPrompt = $state<FindAllPrompt | null>(null);
  let found = $state<Pos[]>([]);
  let missed = $state<Pos[]>([]);
  let wrongFlash = $state<Pos | null>(null);
  let awaitingAdvance = $state(false);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let promptHadWrong = $state(false);
  let showFretNumbers = $state(untrack(() => config.showFretNumbers));
  let paused = $state(false);

  function endSession(soft: boolean) {
    const report = exercise.getReport();
    if (soft) onComplete(report);
    else onAbort(report);
  }

  $effect(() => {
    if (!awaitingAdvance || paused) return;
    function handler(e: MouseEvent) {
      if (!awaitingAdvance || paused) return;
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-role="hit"], button, input, label, select, textarea, a')) return;
      nextPrompt();
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  });

  function nextPrompt() {
    found = [];
    missed = [];
    wrongFlash = null;
    awaitingAdvance = false;
    promptHadWrong = false;
    currentPrompt = exercise.getNextPrompt();
  }

  nextPrompt();

  function complete() {
    if (promptHadWrong) incorrectCount += 1;
    else correctCount += 1;
    awaitingAdvance = true;
    wrongFlash = null;
  }

  function handleSelect(pos: Pos) {
    if (paused) return;
    if (awaitingAdvance) { nextPrompt(); return; }
    if (!currentPrompt) return;
    if (config.playSound) {
      try { playPluck(pos.string, pos.fret); } catch { /* ignore */ }
    }
    const result = exercise.submitAnswer(pos);
    if (result.correct) {
      found = [...found, pos];
      wrongFlash = null;
    } else {
      promptHadWrong = true;
      wrongFlash = pos;
    }
    if (result.promptComplete) complete();
  }

  function giveUp() {
    if (paused || awaitingAdvance || !currentPrompt) return;
    missed = exercise.reveal().correctAnswers;
    promptHadWrong = true;
    complete();
  }

  const highlights = $derived<Highlight[]>(
    paused || !currentPrompt
      ? []
      : [
          ...found.map(p => ({ ...p, note: noteAt(p.string, p.fret), kind: 'user-correct' as const })),
          ...missed.map(p => ({ ...p, note: noteAt(p.string, p.fret), kind: 'correct-flash' as const })),
          ...(wrongFlash ? [{ ...wrongFlash, note: noteAt(wrongFlash.string, wrongFlash.fret), kind: 'user-wrong' as const }] : [])
        ]
  );

  const whole = $derived(currentPrompt ? currentPrompt.window[1] - currentPrompt.window[0] >= config.maxFret : true);
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
      {#if currentPrompt}
        Find every <strong>{NOTE_DISPLAY[currentPrompt.targetNote]}</strong>
        {whole ? 'on the neck' : `in frets ${currentPrompt.window[0]}–${currentPrompt.window[1]}`}
      {/if}
    </div>
    <div class="progress">{found.length} / {currentPrompt?.expectedCount ?? 0}</div>
    <button type="button" class="give-up" disabled={awaitingAdvance} onclick={giveUp}>Show the rest</button>
    <label class="toggle">
      <input type="checkbox" bind:checked={showFretNumbers} />
      Fret numbers
    </label>
  {/snippet}

  <div class="board" class:paused={paused}>
    <Fretboard
      maxFret={config.maxFret}
      fretNumbersVisible={showFretNumbers}
      {highlights}
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
    <div class="continue-hint">
      {missed.length > 0 ? `Missed ${missed.length}, shown in green` : promptHadWrong ? 'All found (with a miss)' : 'All found'} — click anywhere to continue →
    </div>
  {/if}
</SessionShell>

<style>
  .target { font-size: 20px; }
  .progress { font-size: 18px; font-variant-numeric: tabular-nums; opacity: 0.85; }
  .give-up { font-size: 14px; }
  .toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; user-select: none; }
  .board { background: #2a2018; padding: 20px; border-radius: 8px; position: relative; }
  .board.paused :global(.fretboard) { filter: blur(2px) brightness(0.6); }
  .paused-overlay {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.35); pointer-events: none;
  }
  .paused-text {
    font-size: 48px; font-weight: 700; letter-spacing: 0.05em;
    color: rgba(232, 227, 211, 0.7); text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }
  .paused-hint { font-size: 14px; opacity: 0.8; color: #cfc6b3; }
  .continue-hint { text-align: center; font-size: 14px; opacity: 0.7; padding: 8px; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
</style>
