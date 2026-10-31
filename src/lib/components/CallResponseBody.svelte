<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import MicSettings from './MicSettings.svelte';
  import Tuner from './Tuner.svelte';
  import { CallResponseExercise } from '../exercise/callresponse/CallResponseExercise';
  import { PHRASE_BPM, type CallResponseConfig, type CallResponsePrompt, type CallResponseReport } from '../exercise/callresponse/types';
  import type { Pos } from '../music/caged';
  import { noteAt, pitchOf, CHROMATIC, NOTE_DISPLAY } from '../music/notes';
  import { playPluck, midiAsPos } from '../audio/pluck';
  import { playSequence } from '../audio/sequence';
  import { startDrone, midiForDrone, type DroneHandle } from '../audio/drone';
  import { startPitchListener, listAudioInputs, type PitchListener } from '../audio/pitch';
  import type { TunerReading } from '../audio/tuner';
  import { loadPrefs, updatePrefs } from '../storage/prefs';

  type Props = {
    config: CallResponseConfig;
    onComplete: (report: CallResponseReport) => void;
    onAbort: (report: CallResponseReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new CallResponseExercise();
  untrack(() => exercise.start(config));
  const mic = untrack(() => config.inputMode === 'mic');
  const SIXTEENTH_MS = 60000 / PHRASE_BPM / 4;
  // Mic input is ignored this long after the phrase ends (speaker ring-out).
  const ECHO_GUARD_MS = 400;

  let currentPrompt = $state<CallResponsePrompt | null>(null);
  let phase = $state<'playing' | 'listening' | 'done'>('playing');
  let heard = $state<Array<{ label: string; ok: boolean }>>([]);
  let clicked = $state<Highlight[]>([]);
  let lastCorrect = $state<boolean | null>(null);
  let rhythmOff = $state(false);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let showFretNumbers = $state(untrack(() => config.showFretNumbers));
  let paused = $state(false);

  let cancelPlayback: (() => void) | null = null;
  let listenTimer: ReturnType<typeof setTimeout> | undefined;
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  function stopPlayback() {
    cancelPlayback?.();
    cancelPlayback = null;
    clearTimeout(listenTimer);
  }

  function endSession(soft: boolean) {
    stopPlayback();
    clearTimeout(advanceTimer);
    const report = exercise.getReport();
    if (soft) onComplete(report);
    else onAbort(report);
  }

  // Plays the call; the response clock (and the mic) start when it ends.
  function play() {
    const p = currentPrompt;
    if (!p) return;
    stopPlayback();
    if (phase !== 'done') phase = 'playing';
    const gaps = p.notes.slice(0, -1).map(n => n.sixteenths * SIXTEENTH_MS);
    try { cancelPlayback = playSequence(p.notes.map(n => midiAsPos(n.midi)), gaps); } catch { /* ignore */ }
    const total = gaps.reduce((a, b) => a + b, 0) + p.notes[p.notes.length - 1].sixteenths * SIXTEENTH_MS;
    listenTimer = setTimeout(() => {
      if (phase === 'playing') { phase = 'listening'; exercise.markListening(); }
    }, total + ECHO_GUARD_MS);
  }

  function nextPrompt() {
    clearTimeout(advanceTimer);
    heard = [];
    clicked = [];
    lastCorrect = null;
    rhythmOff = false;
    phase = 'playing';
    currentPrompt = exercise.getNextPrompt();
    play();
  }

  nextPrompt();

  // Drone the key root under the phrase (opt-in); silent while paused.
  let drone: DroneHandle | null = null;
  $effect(() => {
    const key = currentPrompt?.keyRoot;
    if (config.drone && key && !paused) drone = startDrone(midiForDrone(key));
    return () => { drone?.stop(); drone = null; };
  });

  // Pausing cuts the call short; resuming plays it again.
  let wasPaused = false;
  $effect(() => {
    if (paused) { wasPaused = true; stopPlayback(); clearTimeout(advanceTimer); return; }
    if (!wasPaused) return;
    wasPaused = false;
    untrack(() => { if (phase === 'done') nextPrompt(); else play(); });
  });

  function submit(midi: number, atSec?: number) {
    if (!currentPrompt || phase === 'done') return;
    const r = exercise.submitNote(midi, atSec);
    heard = [...heard, { label: NOTE_DISPLAY[CHROMATIC[((midi % 12) + 12) % 12]], ok: r.noteCorrect }];
    if (r.done) finish(r.correct, r.rhythmOff);
  }

  function finish(correct: boolean, offBeat: boolean) {
    stopPlayback();
    phase = 'done';
    lastCorrect = correct;
    rhythmOff = offBeat;
    if (correct) correctCount += 1;
    else incorrectCount += 1;
    if (mic) advanceTimer = setTimeout(() => { if (!paused) nextPrompt(); }, correct ? 1500 : 3000);
  }

  function giveUp() {
    if (!currentPrompt || phase === 'done') return;
    exercise.skip();
    finish(false, false);
  }

  function handleSelect(pos: Pos) {
    if (paused || !currentPrompt) return;
    if (phase === 'done') { nextPrompt(); return; }
    if (mic && micError === null) return;
    if (config.playSound) { try { playPluck(pos.string, pos.fret); } catch { /* ignore */ } }
    const before = heard.length;
    submit(pitchOf(pos.string, pos.fret));
    const ok = heard[before]?.ok ?? false;
    clicked = [...clicked, { string: pos.string, fret: pos.fret, note: noteAt(pos.string, pos.fret), kind: ok ? 'user-correct' : 'user-wrong' }];
  }

  // Click anywhere off the board and controls to continue once done.
  $effect(() => {
    if (phase !== 'done' || paused) return;
    function handler(e: MouseEvent) {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-role="hit"], button, input, label, select, textarea, a')) return;
      nextPrompt();
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  });

  // --- Mic -----------------------------------------------------------------
  let micError = $state<string | null>(null);
  let lastHeard = $state<string | null>(null);
  let micSensitivity = $state(untrack(() => config.micSensitivity));
  let micDeviceId = $state(untrack(() => config.micDeviceId));
  let micDevices = $state<Array<{ deviceId: string; label: string }>>([]);
  let micListener: PitchListener | null = null;
  let showTuner = $state(loadPrefs().showTuner ?? false);
  let tuner = $state<TunerReading | null>(null);

  $effect(() => {
    if (!mic) return;
    const deviceId = micDeviceId;
    let cancelled = false;
    micListener = null;
    startPitchListener((midi) => {
      if (cancelled) return;
      lastHeard = CHROMATIC[((midi % 12) + 12) % 12];
      // Only the response counts: not the call coming out of the speaker.
      if (paused || phase !== 'listening') return;
      submit(midi, performance.now() / 1000);
    }, { sensitivity: untrack(() => micSensitivity), deviceId, onTuner: (r) => { if (showTuner) tuner = r; } })
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

  const phraseText = $derived(
    currentPrompt ? currentPrompt.notes.map(n => NOTE_DISPLAY[n.note]).join(' – ') + ` (${currentPrompt.notes.map(n => n.degree).join(' ')})` : ''
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
      {#if currentPrompt}
        Key of <strong>{NOTE_DISPLAY[currentPrompt.keyRoot]}</strong> —
        {phase === 'playing' ? 'listen…' : `play it back (${currentPrompt.notes.length} notes)`}
        {#if config.showStart}<span class="start">starts on {NOTE_DISPLAY[currentPrompt.notes[0].note]} ({currentPrompt.notes[0].degree})</span>{/if}
      {/if}
    </div>
    {#if mic}
      <div class="mic" class:mic-error={micError !== null}>
        {#if micError}{micError}{:else}🎤 {phase === 'listening' ? 'listening' : 'waiting'}{lastHeard ? ` — heard ${lastHeard}` : '…'}{/if}
      </div>
      {#if showTuner}<Tuner reading={tuner} compact />{/if}
      <label class="toggle">
        <input type="checkbox" bind:checked={showTuner} onchange={() => updatePrefs({ showTuner })} />
        Tuner
      </label>
    {/if}
    <label class="toggle">
      <input type="checkbox" bind:checked={showFretNumbers} />
      Fret numbers
    </label>
  {/snippet}

  <div class="slots" aria-label="Response">
    {#each currentPrompt?.notes ?? [] as _, i}
      <span class="slot" class:ok={heard[i]?.ok} class:bad={heard[i] && !heard[i].ok}>{heard[i]?.label ?? '?'}</span>
    {/each}
    <button type="button" onclick={play} disabled={paused}>Replay</button>
    <button type="button" onclick={giveUp} disabled={paused || phase === 'done'}>Show me</button>
  </div>

  <div class="board" class:paused={paused}>
    <Fretboard maxFret={config.maxFret} fretNumbersVisible={showFretNumbers} highlights={paused ? [] : clicked} onSelect={handleSelect} />
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

  {#if phase === 'done' && !paused}
    <div class="continue-hint">
      {lastCorrect ? 'Correct' : rhythmOff ? `Right notes, but the rhythm was off: ${phraseText}` : `It was ${phraseText}`}{mic ? '' : ' — click anywhere to continue →'}
    </div>
  {/if}
</SessionShell>

<style>
  .target { font-size: 20px; }
  .start { margin-left: 8px; font-size: 16px; opacity: 0.8; }
  .mic { font-size: 14px; opacity: 0.85; }
  .mic-error { color: #e07a5f; opacity: 1; }
  .toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; user-select: none; }
  .slots { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .slot {
    min-width: 44px; padding: 6px 10px; text-align: center; border: 1px solid #666; border-radius: 6px;
    font-variant-numeric: tabular-nums;
  }
  .slot.ok { background: #5fb35a; color: #0a0a0a; border-color: #5fb35a; }
  .slot.bad { background: #d65a3d; color: #0a0a0a; border-color: #d65a3d; }
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
  .pause-mic {
    pointer-events: auto; margin-top: 16px; padding: 14px 18px;
    background: rgba(20, 16, 12, 0.92); border: 1px solid #4a3f33; border-radius: 8px; max-width: 440px;
  }
  .continue-hint { text-align: center; font-size: 14px; opacity: 0.7; padding: 8px; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
</style>
