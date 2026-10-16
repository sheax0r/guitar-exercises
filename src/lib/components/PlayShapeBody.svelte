<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import { PlayShapeExercise } from '../exercise/modes/PlayShapeExercise';
  import type { PlayShapeConfig, PlayShapePrompt, ModesReport, Pos } from '../exercise/modes/types';
  import { noteAt, positionForPitch, CHROMATIC } from '../music/notes';
  import { MODE_DISPLAY, characteristicNote } from '../music/modes';
  import { playPluck } from '../audio/pluck';
  import { startDrone, midiForDrone, type DroneHandle } from '../audio/drone';
  import { startPitchListener, type PitchListener } from '../audio/pitch';

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

  // Drone the root under the active prompt (opt-in). Restart on each new root,
  // silence while paused, and clean up on teardown so no oscillator is left on.
  let droneHandle: DroneHandle | null = null;
  $effect(() => {
    if (config.drone && currentPrompt && !paused) {
      droneHandle?.stop();
      droneHandle = startDrone(midiForDrone(currentPrompt.rootNote));
    } else {
      droneHandle?.stop();
      droneHandle = null;
    }
    return () => { droneHandle?.stop(); droneHandle = null; };
  });

  // Mic input: detected pitches drive the same answer path as clicks. Only
  // reached for the octave/pitch variant (enforced by the start screen).
  let micError = $state<string | null>(null);
  let lastHeard = $state<string | null>(null);
  $effect(() => {
    if (config.inputMode !== 'mic') return;
    let listener: PitchListener | null = null;
    let cancelled = false;
    startPitchListener((midi) => {
      if (cancelled) return;
      lastHeard = CHROMATIC[((midi % 12) + 12) % 12];
      if (paused) return;
      const pos = positionForPitch(midi, config.maxFret);
      if (pos) handleSelect(pos);
    })
      .then((l) => { if (cancelled) l.stop(); else listener = l; })
      .catch(() => { micError = 'Microphone unavailable — use clicks instead.'; });
    return () => { cancelled = true; listener?.stop(); };
  });

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
          const charNote = config.highlightCharacteristic && currentPrompt
            ? characteristicNote(currentPrompt.rootNote, currentPrompt.mode)
            : null;
          for (const p of litCorrect) {
            const note = noteAt(p.string, p.fret);
            // A correctly-played note that IS the mode's characteristic degree
            // lights in the characteristic colour, drawing the ear to it without
            // revealing the shape ahead of time.
            const kind = charNote !== null && note === charNote ? 'characteristic' : 'user-correct';
            out.push({ string: p.string, fret: p.fret, note, kind });
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
    {#if config.inputMode === 'mic'}
      <div class="mic" class:mic-error={micError !== null}>
        {#if micError}{micError}{:else}🎤 listening{lastHeard ? ` — heard ${lastHeard}` : '…'}{/if}
      </div>
    {/if}
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
  .mic { font-size: 14px; opacity: 0.85; }
  .mic-error { color: #e07a5f; opacity: 1; }
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
