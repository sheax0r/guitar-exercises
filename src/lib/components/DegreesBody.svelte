<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import { DegreesExercise } from '../exercise/degrees/DegreesExercise';
  import type { DegreesConfig, DegreesPrompt, DegreesReport } from '../exercise/degrees/types';
  import type { Pos } from '../music/caged';
  import { noteAt, NOTE_DISPLAY } from '../music/notes';
  import { DEGREE_LABELS, type Degree } from '../music/scales';
  import { playPluck, playInterval } from '../audio/pluck';

  type Props = {
    config: DegreesConfig;
    onComplete: (report: DegreesReport) => void;
    onAbort: (report: DegreesReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new DegreesExercise();
  untrack(() => exercise.start(config));
  const variant = untrack(() => config.degreeVariant);

  let currentPrompt = $state<DegreesPrompt | null>(null);
  let flash = $state<Highlight[]>([]);
  let picked = $state<Degree | null>(null);
  let lastCorrect = $state<boolean | null>(null);
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

  // Click anywhere off the board and controls to advance once answered.
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
    flash = [];
    picked = null;
    lastCorrect = null;
    awaitingAdvance = false;
    currentPrompt = exercise.getNextPrompt();
  }

  nextPrompt();

  function record(correct: boolean) {
    lastCorrect = correct;
    if (correct) correctCount += 1;
    else incorrectCount += 1;
    awaitingAdvance = true;
  }

  const mark = (p: Pos, kind: Highlight['kind']): Highlight =>
    ({ string: p.string, fret: p.fret, note: noteAt(p.string, p.fret), kind });

  // 'name': pick a degree button.
  function pickDegree(d: Degree) {
    if (paused || awaitingAdvance || !currentPrompt) return;
    picked = d;
    const result = exercise.submitAnswer({ degree: d });
    if (config.playSound) {
      try { playPluck(currentPrompt.highlight.string, currentPrompt.highlight.fret); } catch { /* ignore */ }
    }
    // Reveal the note's name once answered.
    flash = [mark(currentPrompt.highlight, result.correct ? 'user-correct' : 'user-wrong')];
    record(result.correct);
  }

  // 'find': click the nearest occurrence.
  function handleSelect(pos: Pos) {
    if (paused) return;
    if (awaitingAdvance) { nextPrompt(); return; }
    if (!currentPrompt || variant !== 'find') return;
    const start = currentPrompt.highlight;
    const result = exercise.submitAnswer(pos);
    const answers = result.correctAnswers as Pos[];
    if (result.correct) {
      flash = [mark(start, 'prompt'), mark(pos, 'user-correct')];
      if (config.playSound) { try { playInterval(start, pos); } catch { /* ignore */ } }
    } else {
      flash = [mark(start, 'prompt'), mark(pos, 'user-wrong'), ...answers.map(a => mark(a, 'correct-flash'))];
      if (config.playSound) { try { playPluck(answers[0].string, answers[0].fret); } catch { /* ignore */ } }
    }
    record(result.correct);
  }

  const highlights = $derived<Highlight[]>(
    paused || !currentPrompt ? [] : flash.length > 0 ? flash : [mark(currentPrompt.highlight, 'prompt')]
  );

  function buttonClass(d: Degree): string {
    if (lastCorrect === null || !currentPrompt) return '';
    if (d === currentPrompt.degree) return 'right';
    return d === picked ? 'wrong' : '';
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
    <div class="target">
      {#if !currentPrompt}
        …
      {:else if variant === 'name'}
        Key of <strong>{NOTE_DISPLAY[currentPrompt.keyRoot]}</strong> — which degree is the highlighted note?
      {:else}
        Find the <strong>{currentPrompt.degree}</strong> of <strong>{NOTE_DISPLAY[currentPrompt.keyRoot]}</strong>, nearest the highlighted note
      {/if}
    </div>
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

  {#if variant === 'name' && !paused}
    <div class="choices" role="group" aria-label="Degree">
      {#each DEGREE_LABELS as d}
        <button type="button" class="choice {buttonClass(d)}" disabled={awaitingAdvance} onclick={() => pickDegree(d)}>{d}</button>
      {/each}
    </div>
  {/if}

  {#if awaitingAdvance && !paused && currentPrompt}
    <div class="continue-hint">
      {lastCorrect ? 'Correct' : variant === 'name'
        ? `It was the ${currentPrompt.degree} (${NOTE_DISPLAY[currentPrompt.targetNote]})`
        : `The nearest ${currentPrompt.degree} is ${NOTE_DISPLAY[currentPrompt.targetNote]}, shown in green`} — click anywhere to continue →
    </div>
  {/if}
</SessionShell>

<style>
  .target { font-size: 20px; }
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
  .choices { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  .choice {
    min-width: 52px; padding: 12px 14px; font-size: 16px; border-radius: 8px;
    border: 1px solid #888; background: transparent; color: inherit; cursor: pointer;
  }
  .choice:disabled { cursor: default; }
  .choice.right { background: #5fb35a; color: #0a0a0a; border-color: #5fb35a; font-weight: 700; }
  .choice.wrong { background: #d65a3d; color: #0a0a0a; border-color: #d65a3d; font-weight: 700; }
  .continue-hint { text-align: center; font-size: 14px; opacity: 0.7; padding: 8px; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
</style>
