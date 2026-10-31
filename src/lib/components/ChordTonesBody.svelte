<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import MicSettings from './MicSettings.svelte';
  import { ChordTonesExercise } from '../exercise/chordtones/ChordTonesExercise';
  import type { ChordTonesConfig, ChordTonesPrompt, ChordTonesReport } from '../exercise/chordtones/types';
  import { progressionChords } from '../music/progressions';
  import { CHORD_OFFSETS, chordName, type ChordType, type Pos } from '../music/caged';
  import { noteAt, CHROMATIC, NOTE_DISPLAY, type Note } from '../music/notes';
  import { playPluck } from '../audio/pluck';
  import { playSequence } from '../audio/sequence';
  import { startDrone, midiForDrone, type DroneHandle } from '../audio/drone';
  import { startMetronome } from '../audio/metronome';
  import { loadCalibMs } from '../audio/calibration';
  import { getAudioContext } from '../audio/context';
  import { startPitchListener, listAudioInputs, type PitchListener } from '../audio/pitch';

  type Props = {
    config: ChordTonesConfig;
    onComplete: (report: ChordTonesReport) => void;
    onAbort: (report: ChordTonesReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new ChordTonesExercise();
  untrack(() => exercise.start(config));
  const timed = untrack(() => config.tempo === 'timed');
  const mic = untrack(() => config.inputMode === 'mic');
  const chords = untrack(() => progressionChords(config.progression));

  let currentPrompt = $state<ChordTonesPrompt | null>(null);
  // The chord on screen: in timed mode it changes on the beat, slightly before
  // the prompt opens (the latency offset).
  let shown = $state<{ index: number; chordRoot: Note; chordType: ChordType } | null>(null);
  let flash = $state<Highlight[]>([]);
  let lastCorrect = $state<boolean | null>(null);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let showFretNumbers = $state(untrack(() => config.showFretNumbers));
  let paused = $state(false);
  let beat = $state<number | null>(null);
  let needsTap = $state(false);
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  function endSession(soft: boolean) {
    clearTimeout(advanceTimer);
    const report = exercise.getReport();
    if (soft) onComplete(report);
    else onAbort(report);
  }

  // --- Backing -------------------------------------------------------------
  let drone: DroneHandle | null = null;
  function soundChord(c: { chordRoot: Note; chordType: ChordType }) {
    if (config.backing === 'drone') {
      drone?.stop();
      drone = startDrone(midiForDrone(c.chordRoot));
    } else if (config.backing === 'chord') {
      // Pluck takes a string and fret; the low E (MIDI 40) with a high "fret"
      // sounds any pitch, here a quick low arpeggio from the drone octave.
      const root = midiForDrone(c.chordRoot);
      try { playSequence(CHORD_OFFSETS[c.chordType].map(o => ({ string: 6 as const, fret: root + o - 40 })), 35); } catch { /* ignore */ }
    }
  }
  // Pausing silences the drone; untimed resume sounds the chord again (timed
  // re-sounds it after the count-in).
  let wasPaused = false;
  $effect(() => {
    if (paused) { wasPaused = true; drone?.stop(); drone = null; return; }
    if (!wasPaused) return;
    wasPaused = false;
    const s = untrack(() => shown);
    if (!timed && s) soundChord(s);
  });
  $effect(() => () => { drone?.stop(); drone = null; });

  // --- Prompts -------------------------------------------------------------
  function advance() {
    clearTimeout(advanceTimer);
    if (currentPrompt && !exercise.isAnswered()) incorrectCount += 1; // missed change
    flash = [];
    lastCorrect = null;
    const p = exercise.getNextPrompt();
    currentPrompt = p;
    if (!timed) {
      shown = p;
      soundChord(p);
    }
  }

  if (!timed) advance();

  const mark = (p: Pos, kind: Highlight['kind']): Highlight =>
    ({ string: p.string, fret: p.fret, note: noteAt(p.string, p.fret), kind });

  function judged(correct: boolean, shownAnswer: Highlight[]) {
    lastCorrect = correct;
    if (correct) correctCount += 1;
    else incorrectCount += 1;
    flash = shownAnswer;
    // Untimed: a right answer moves on by itself; a wrong one waits for a click
    // (or a moment, with the mic). Timed: the next change moves on.
    if (!timed && (correct || mic)) advanceTimer = setTimeout(() => { if (!paused) advance(); }, correct ? 700 : 1600);
  }

  function handleSelect(pos: Pos) {
    if (paused || !currentPrompt) return;
    if (exercise.isAnswered()) { if (!timed) advance(); return; }
    if (mic && micError === null) return;
    if (config.playSound) { try { playPluck(pos.string, pos.fret); } catch { /* ignore */ } }
    const result = exercise.submitAnswer(pos);
    judged(result.correct, result.correct
      ? [mark(pos, 'user-correct')]
      : [mark(pos, 'user-wrong'), ...result.correctAnswers.map(a => mark(a, 'correct-flash'))]);
  }

  // Untimed, after a wrong click: click anywhere off the board to continue.
  $effect(() => {
    if (timed || lastCorrect !== false || paused) return;
    function handler(e: MouseEvent) {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-role="hit"], button, input, label, select, textarea, a')) return;
      advance();
    }
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  });

  // --- Timed: metronome, count-in, changes on the beat ----------------------
  $effect(() => {
    if (!timed || paused) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    // Opened from a bookmark or reload there was no click yet, so the browser
    // keeps audio (and the metronome clock) suspended until one.
    const resume = () => { ctx.resume().then(() => { needsTap = false; }).catch(() => { /* ignore */ }); };
    if (ctx.state === 'suspended') { needsTap = true; resume(); }
    window.addEventListener('pointerdown', resume, { once: true });
    // A mic note heard up to |offset| ms after a change was played before it,
    // so the judging cut-over waits that long (offset < 0 = input is late).
    const judgeLagMs = mic ? -loadCalibMs() : 0;
    const beatsPerBar = 4;
    let nextChange = beatsPerBar; // one bar of count-in
    // After a pause, the unanswered chord carries on instead of being a miss.
    let carryOver = untrack(() => currentPrompt !== null && !exercise.isAnswered());
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, f: () => void) => timers.push(setTimeout(f, Math.max(0, ms)));
    const stop = startMetronome(ctx, {
      bpm: config.bpm, num: beatsPerBar, den: 4, startAt: ctx.currentTime + 0.2,
      clickBeat: () => true,
      volume: () => 0.6,
      onBeat: (b, delayMs) => {
        later(delayMs, () => { beat = b < beatsPerBar ? -(beatsPerBar - b) : b % beatsPerBar; });
        if (b !== nextChange) return;
        if (carryOver) {
          carryOver = false;
          const p = untrack(() => currentPrompt)!;
          nextChange = b + beatsPerBar * config.barsPerChord * p.bars;
          later(delayMs, () => { shown = p; soundChord(p); });
          return;
        }
        const up = exercise.upcoming();
        nextChange = b + beatsPerBar * config.barsPerChord * up.bars;
        const index = (untrack(() => currentPrompt)?.index ?? -1) + 1;
        later(delayMs, () => { shown = { ...up, index: index % chords.length }; soundChord(up); });
        later(delayMs + judgeLagMs, advance);
      }
    });
    return () => { stop(); timers.forEach(clearTimeout); beat = null; window.removeEventListener('pointerdown', resume); };
  });

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
      if (paused || !currentPrompt || exercise.isAnswered()) return;
      const result = exercise.submitMicNote(midi);
      judged(result.correct, result.correctAnswers.map(a => mark(a, result.correct ? 'user-correct' : 'correct-flash')));
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

  const highlights = $derived<Highlight[]>(
    paused || !currentPrompt ? [] : [mark(currentPrompt.from, 'prompt'), ...flash]
  );

  const chordLabel = (c: { chordRoot: Note; chordType: ChordType }) => chordName(NOTE_DISPLAY[c.chordRoot], c.chordType);
  const toneLabel = $derived(
    !currentPrompt ? '' : currentPrompt.tone === 'any' ? 'a chord tone' : `the ${currentPrompt.tone}`
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
      {#if !currentPrompt || !shown}
        {timed ? (needsTap ? 'Click anywhere to start the count-in' : 'Count-in…') : '…'}
      {:else}
        <strong>{chordLabel(shown)}</strong> <span class="numeral">({chords[shown.index].numeral})</span> —
        play {toneLabel}{currentPrompt.tone === 'any' ? '' : ` (${NOTE_DISPLAY[currentPrompt.targetNotes[0]]})`}, nearest the highlighted note
      {/if}
    </div>
    {#if timed}
      <div class="beats" aria-label="Beat">
        {#each [0, 1, 2, 3] as i}<span class="dot" class:on={beat === i} class:count={beat !== null && beat < 0 && beat + 4 === i}></span>{/each}
      </div>
    {/if}
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

  <div class="strip" aria-label="Progression">
    {#each chords as c, i}
      <span class="chord" class:now={shown?.index === i}>{c.numeral}{c.bars > 1 ? ` ×${c.bars}` : ''}</span>
    {/each}
    {#if currentPrompt}<span class="key">Key of {NOTE_DISPLAY[currentPrompt.keyRoot]}</span>{/if}
  </div>

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

  {#if lastCorrect !== null && !paused && currentPrompt}
    <div class="continue-hint">
      {lastCorrect ? 'Correct' : `The nearest target is shown in green`}{timed ? ' — wait for the next change' : lastCorrect || mic ? '' : ' — click anywhere to continue →'}
    </div>
  {/if}
</SessionShell>

<style>
  .target { font-size: 20px; }
  .numeral { opacity: 0.75; }
  .beats { display: flex; gap: 6px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #888; }
  .dot.on { background: #ff8c42; border-color: #ff8c42; }
  .dot.count { background: #888; }
  .mic { font-size: 14px; opacity: 0.85; }
  .mic-error { color: #e07a5f; opacity: 1; }
  .toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; user-select: none; }
  .strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 15px; }
  .chord { padding: 4px 10px; border: 1px solid #555; border-radius: 6px; opacity: 0.7; }
  .chord.now { border-color: #ff8c42; opacity: 1; font-weight: 700; }
  .key { margin-left: auto; opacity: 0.75; font-size: 14px; }
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
