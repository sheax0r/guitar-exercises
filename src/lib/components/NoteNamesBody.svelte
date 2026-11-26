<script lang="ts">
  import { untrack, tick } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import MicSettings from './MicSettings.svelte';
  import { NoteNamesExercise, parseNoteName } from '../exercise/notenames/NoteNamesExercise';
  import type { NoteNamesConfig, NoteNamesPrompt } from '../exercise/notenames/types';
  import type { ExerciseReport } from '../exercise/types';
  import type { Pos } from '../music/caged';
  import { noteAt, pitchOf, CHROMATIC, NOTE_DISPLAY } from '../music/notes';
  import { playPluck } from '../audio/pluck';
  import { startPitchListener, listAudioInputs, type PitchListener } from '../audio/pitch';

  type Props = {
    config: NoteNamesConfig;
    onComplete: (report: ExerciseReport) => void;
    onAbort: (report: ExerciseReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new NoteNamesExercise();
  untrack(() => exercise.start(config));
  const variant = untrack(() => config.noteVariant);
  const mic = untrack(() => variant === 'play' && config.inputMode === 'mic');
  const STRING_NAME = ['', 'high e', 'B', 'G', 'D', 'A', 'low E'];

  let currentPrompt = $state<NoteNamesPrompt | null>(null);
  let flash = $state<Highlight[]>([]);
  let lastCorrect = $state<boolean | null>(null);
  let awaitingAdvance = $state(false);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let showFretNumbers = $state(untrack(() => config.showFretNumbers));
  let paused = $state(false);
  let typed = $state('');
  let typeError = $state(false);
  let input = $state<HTMLInputElement | null>(null);
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  function endSession(soft: boolean) {
    clearTimeout(advanceTimer);
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
    clearTimeout(advanceTimer);
    flash = [];
    lastCorrect = null;
    awaitingAdvance = false;
    typed = '';
    typeError = false;
    currentPrompt = exercise.getNextPrompt();
    tick().then(() => input?.focus());
  }

  nextPrompt();

  const mark = (p: Pos, kind: Highlight['kind']): Highlight =>
    ({ string: p.string, fret: p.fret, note: noteAt(p.string, p.fret), kind });

  function record(correct: boolean) {
    lastCorrect = correct;
    if (correct) correctCount += 1;
    else incorrectCount += 1;
    awaitingAdvance = true;
    // Right answers move on by themselves; wrong ones wait (the mic waits a moment).
    if (correct || mic) advanceTimer = setTimeout(() => { if (!paused && awaitingAdvance) nextPrompt(); }, correct ? 700 : 1600);
  }

  // 'name': type the note and press Enter (Enter again moves on).
  function submitTyped(e: SubmitEvent) {
    e.preventDefault();
    if (paused || !currentPrompt) return;
    if (awaitingAdvance) { nextPrompt(); return; }
    const note = parseNoteName(typed);
    if (!note) { typeError = true; return; }
    const result = exercise.submitAnswer({ note });
    if (config.playSound) { try { playPluck(currentPrompt.highlight.string, currentPrompt.highlight.fret); } catch { /* ignore */ } }
    flash = [mark(currentPrompt.highlight, result.correct ? 'user-correct' : 'user-wrong')];
    record(result.correct);
  }

  function showPlayResult(correct: boolean, hit: Pos | null) {
    const p = currentPrompt!;
    flash = [
      ...(hit ? [mark(hit, correct ? 'user-correct' : 'user-wrong')] : []),
      ...(correct ? [] : p.accepted.map(a => mark(a, 'correct-flash')))
    ];
    record(correct);
  }

  // 'play' by click.
  function handleSelect(pos: Pos) {
    if (paused) return;
    if (awaitingAdvance) { nextPrompt(); return; }
    if (!currentPrompt || variant !== 'play' || (mic && micError === null)) return;
    if (config.playSound) { try { playPluck(pos.string, pos.fret); } catch { /* ignore */ } }
    showPlayResult(exercise.submitAnswer(pos).correct, pos);
  }

  // --- Mic -----------------------------------------------------------------
  let micError = $state<string | null>(null);
  let lastHeard = $state<string | null>(null);
  let micSensitivity = $state(untrack(() => config.micSensitivity));
  let micDeviceId = $state(untrack(() => config.micDeviceId));
  let micDevices = $state<Array<{ deviceId: string; label: string }>>([]);
  let micListener: PitchListener | null = null;

  $effect(() => {
    if (!mic) return;
    const deviceId = micDeviceId;
    let cancelled = false;
    micListener = null;
    startPitchListener((midi) => {
      if (cancelled) return;
      lastHeard = CHROMATIC[((midi % 12) + 12) % 12];
      if (paused || !currentPrompt || awaitingAdvance) return;
      const p = currentPrompt;
      const result = exercise.submitAnswer({ midi });
      showPlayResult(result.correct, p.accepted.find(a => pitchOf(a.string, a.fret) === midi) ?? null);
    }, { sensitivity: untrack(() => micSensitivity), deviceId })
      .then((l) => {
        if (cancelled) { l.stop(); return; }
        micListener = l;
        micError = null;
        listAudioInputs().then((d) => { micDevices = d; });
      })
      .catch(() => { micError = 'Microphone unavailable — use clicks instead.'; });
    return () => { cancelled = true; micListener?.stop(); micListener = null; };
  });
  $effect(() => { micListener?.setSensitivity(micSensitivity); });
  $effect(() => () => clearTimeout(advanceTimer));

  const highlights = $derived<Highlight[]>(
    paused || !currentPrompt ? []
    : flash.length > 0 ? flash
    : variant === 'name' ? [mark(currentPrompt.highlight, 'prompt')] : []
  );
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
        What note is the highlighted fret on the <strong>{STRING_NAME[currentPrompt.string]}</strong> string?
      {:else}
        Play <strong>{NOTE_DISPLAY[currentPrompt.note]}</strong> on the <strong>{STRING_NAME[currentPrompt.string]}</strong> string
      {/if}
    </div>
    {#if mic}
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
      {highlights}
      onSelect={handleSelect}
    />
    {#if paused}
      <div class="paused-overlay">
        <div class="paused-text">Paused</div>
        <div class="paused-hint">Press space or click Resume</div>
        {#if mic}
          <div class="pause-mic">
            <MicSettings bind:sensitivity={micSensitivity} bind:deviceId={micDeviceId} devices={micDevices} />
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if variant === 'name' && !paused}
    <form class="answer" onsubmit={submitTyped}>
      <input
        bind:this={input}
        bind:value={typed}
        oninput={() => (typeError = false)}
        class:bad={typeError}
        type="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="8"
        placeholder="e.g. F#, Bb"
        aria-label="Note name"
        readonly={awaitingAdvance}
      />
      <button type="submit">{awaitingAdvance ? 'Next' : 'Check'}</button>
    </form>
    {#if typeError}<div class="type-error">Type a note letter A–G, with # or b if needed.</div>{/if}
  {/if}

  {#if awaitingAdvance && !paused && currentPrompt}
    <div class="continue-hint">
      {lastCorrect ? 'Correct' : variant === 'name'
        ? `It was ${NOTE_DISPLAY[currentPrompt.note]}`
        : `${NOTE_DISPLAY[currentPrompt.note]} on that string is shown in green`}{lastCorrect || mic ? '' : variant === 'name' ? ' — press Enter to continue →' : ' — click anywhere to continue →'}
    </div>
  {/if}
</SessionShell>

<style>
  .target { font-size: 20px; }
  .toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; user-select: none; }
  .mic { font-size: 14px; opacity: 0.85; }
  .mic-error { color: #e07a5f; opacity: 1; }
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
  .pause-mic { pointer-events: auto; background: rgba(0, 0, 0, 0.6); padding: 12px; border-radius: 8px; color: #e8e3d3; }
  .answer { display: flex; gap: 10px; justify-content: center; }
  .answer input { font-size: 22px; width: 7em; padding: 8px 12px; text-align: center; border-radius: 8px; border: 1px solid #888; }
  .answer input.bad { border-color: #d65a3d; }
  .answer button { font-size: 16px; padding: 8px 18px; border-radius: 8px; }
  .type-error { text-align: center; font-size: 14px; color: #e07a5f; }
  .continue-hint { text-align: center; font-size: 14px; opacity: 0.7; padding: 8px; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
</style>
