<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import SessionShell from './SessionShell.svelte';
  import MicSettings from './MicSettings.svelte';
  import { CagedExercise } from '../exercise/caged/CagedExercise';
  import type { CagedConfig, CagedPrompt, CagedReport } from '../exercise/caged/types';
  import { CAGED_ORDER, CHORD_DISPLAY, chordName, type CagedShape, type Pos } from '../music/caged';
  import { noteAt, CHROMATIC, NOTE_DISPLAY, type Note } from '../music/notes';
  import { playPluck } from '../audio/pluck';
  import Tuner from './Tuner.svelte';
  import type { TunerReading } from '../audio/tuner';
  import { loadPrefs, updatePrefs } from '../storage/prefs';
  import { startPitchListener, listAudioInputs, type PitchListener } from '../audio/pitch';
  import { startStrumCapture, strumPitches, type StrumCapture, type StrumVerdict } from '../audio/strum';

  type Props = {
    config: CagedConfig;
    onComplete: (report: CagedReport) => void;
    onAbort: (report: CagedReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new CagedExercise();
  untrack(() => exercise.start(config));
  const variant = untrack(() => config.cagedVariant);
  const shapeChoices = untrack(() => CAGED_ORDER.filter(s => config.enabledShapes.includes(s)));

  let currentPrompt = $state<CagedPrompt | null>(null);
  let litCorrect = $state<Pos[]>([]);
  let wrongFlash = $state<Pos | null>(null);
  let awaitingAdvance = $state(false);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let promptHadWrong = false;
  // name-shape picks; the root is pre-filled when it is fixed for the session.
  let pickedShape = $state<CagedShape | null>(null);
  let pickedRoot = $state<Note | null>(null);
  let nameCorrect = $state<boolean | null>(null);

  let showFretNumbers = $state(untrack(() => config.showFretNumbers));
  let paused = $state(false);

  // Mic input (find-tones only): same plumbing as Play the Shape.
  let micError = $state<string | null>(null);
  let lastHeard = $state<string | null>(null);
  let micAdvanceTimer: ReturnType<typeof setTimeout> | undefined;
  let micSensitivity = $state(untrack(() => config.micSensitivity));
  let micDeviceId = $state(untrack(() => config.micDeviceId));
  let micDevices = $state<Array<{ deviceId: string; label: string }>>([]);
  let micListener: PitchListener | null = null;
  // Opt-in intonation check (off by default; remembered across sessions).
  let showTuner = $state(loadPrefs().showTuner ?? false);
  let tuner = $state<TunerReading | null>(null);

  $effect(() => {
    if (config.inputMode !== 'mic' || strumMode) return;
    const deviceId = micDeviceId;
    let cancelled = false;
    micListener = null;
    startPitchListener((midi) => {
      if (cancelled) return;
      lastHeard = CHROMATIC[((midi % 12) + 12) % 12];
      if (paused || awaitingAdvance || !currentPrompt) return;
      const result = exercise.submitMicNote(midi);
      if (result.correct) litCorrect = [...litCorrect, result.correctAnswers[0]];
      else promptHadWrong = true;
      finishIfComplete(result.promptComplete);
    }, { sensitivity: untrack(() => micSensitivity), deviceId, onTuner: (r) => { if (showTuner) tuner = r; } })
      .then((l) => {
        if (cancelled) { l.stop(); return; }
        micListener = l;
        micError = null;
        listAudioInputs().then((d) => { micDevices = d; });
      })
      .catch(() => { micError = 'Microphone unavailable — use clicks instead.'; });
    return () => { cancelled = true; micListener?.stop(); micListener = null; clearTimeout(micAdvanceTimer); };
  });
  $effect(() => { micListener?.setSensitivity(micSensitivity); });

  // Strum mode (find-tones): "play, then check". A ~2 s take starts on an onset
  // (or the Record button), then Basic Pitch, lazy-loaded on first use, judges
  // the chord's pitch-class set.
  const strumMode = untrack(() => config.inputMode === 'mic' && config.micJudge !== 'notes');
  let strumState = $state<'listening' | 'recording' | 'analyzing'>('listening');
  let strumFeedback = $state<string | null>(null);
  let modelReady = $state(false);
  let strumCap: StrumCapture | null = null;

  async function analyzeStrum(data: Float32Array, sampleRate: number): Promise<number[]> {
    const { detectNotes } = await import('../transcribe/detect');
    const notes = await detectNotes(
      { sampleRate, getChannelData: () => data },
      { engine: 'ai', instrument: 'guitar', clarity: 0, minMs: 0, mergeMs: 0 }
    );
    modelReady = true;
    return strumPitches(notes);
  }

  const pcName = (pc: number) => NOTE_DISPLAY[CHROMATIC[pc]];
  function describeStrum(v: StrumVerdict): string {
    if (v.correct) return 'That\'s the chord.';
    const out: string[] = [];
    if (v.bassPc === null) return 'Heard nothing; strum again.';
    if (v.missing.length) out.push(`missing ${v.missing.map(pcName).join(' ')}`);
    if (v.extra.length) out.push(`extra ${v.extra.map(pcName).join(' ')}`);
    if (!v.bassOk && currentPrompt) out.push(`lowest note ${pcName(v.bassPc)}, want ${NOTE_DISPLAY[currentPrompt.rootNote]} in the bass`);
    return out.join('; ');
  }

  function armStrum() {
    strumState = 'listening';
    strumCap?.arm();
  }

  $effect(() => {
    if (!strumMode) return;
    const deviceId = micDeviceId;
    let cancelled = false;
    strumCap = null;
    startStrumCapture(async (data, sampleRate) => {
      if (cancelled) return;
      if (paused || awaitingAdvance || !currentPrompt) { armStrum(); return; }
      strumState = 'analyzing';
      let midis: number[];
      try {
        midis = await analyzeStrum(data, sampleRate);
      } catch {
        if (cancelled) return;
        strumFeedback = 'Chord model failed to load; check your connection.';
        armStrum();
        return;
      }
      if (cancelled) return;
      if (paused || awaitingAdvance || !currentPrompt) { armStrum(); return; }
      const result = exercise.submitStrum(midis, config.micJudge === 'strum-bass');
      lastHeard = midis.length ? [...new Set(midis.map(m => pcName(m % 12)))].join(' ') : null;
      strumFeedback = describeStrum(result.verdict);
      if (result.correct) litCorrect = result.correctAnswers;
      else promptHadWrong = true;
      finishIfComplete(result.promptComplete);
      if (!result.promptComplete) armStrum();
    }, { sensitivity: untrack(() => micSensitivity), deviceId, onRecording: () => { strumState = 'recording'; } })
      .then((c) => {
        if (cancelled) { c.stop(); return; }
        strumCap = c;
        micError = null;
        if (!awaitingAdvance) armStrum();
        listAudioInputs().then((d) => { micDevices = d; });
      })
      .catch(() => { micError = 'Microphone unavailable — use clicks instead.'; });
    return () => { cancelled = true; strumCap?.stop(); strumCap = null; clearTimeout(micAdvanceTimer); };
  });
  $effect(() => { strumCap?.setSensitivity(micSensitivity); });

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
    clearTimeout(micAdvanceTimer);
    litCorrect = [];
    wrongFlash = null;
    awaitingAdvance = false;
    promptHadWrong = false;
    pickedShape = null;
    pickedRoot = config.fixedRootNote;
    nameCorrect = null;
    strumFeedback = null;
    currentPrompt = exercise.getNextPrompt();
    if (strumMode) armStrum();
  }

  nextPrompt();

  function handleSelect(pos: Pos) {
    if (paused) return;
    if (awaitingAdvance) { nextPrompt(); return; }
    if (!currentPrompt || variant === 'name-shape') return;
    if (config.playSound && config.inputMode !== 'mic') {
      try { playPluck(pos.string, pos.fret); } catch { /* ignore */ }
    }
    const result = exercise.submitAnswer(pos);
    if (result.correct) {
      litCorrect = [...litCorrect, pos];
      wrongFlash = null;
    } else {
      promptHadWrong = true;
      wrongFlash = pos;
    }
    finishIfComplete(result.promptComplete);
  }

  function finishIfComplete(done: boolean) {
    if (!done) return;
    if (promptHadWrong) incorrectCount += 1;
    else correctCount += 1;
    awaitingAdvance = true;
    wrongFlash = null;
    if (config.inputMode === 'mic') {
      clearTimeout(micAdvanceTimer);
      micAdvanceTimer = setTimeout(() => { if (awaitingAdvance && !paused) nextPrompt(); }, 1600);
    }
  }

  function pickName(shape: CagedShape | null, root: Note | null) {
    if (paused || awaitingAdvance) return;
    pickedShape = shape ?? pickedShape;
    pickedRoot = root ?? pickedRoot;
    if (!pickedShape || !pickedRoot) return;
    const result = exercise.submitAnswer({ shape: pickedShape, root: pickedRoot });
    nameCorrect = result.correct;
    promptHadWrong = !result.correct;
    finishIfComplete(true);
  }

  const highlights = $derived<Highlight[]>(
    paused || !currentPrompt
      ? []
      : (() => {
          const p = currentPrompt;
          const out: Highlight[] = [];
          const mark = (pos: Pos, kind: Highlight['kind']) =>
            out.push({ string: pos.string, fret: pos.fret, note: noteAt(pos.string, pos.fret), kind });
          // The shape on screen (name-shape, next-shape): roots stand out.
          for (const pos of p.shownPositions) mark(pos, noteAt(pos.string, pos.fret) === p.rootNote ? 'scale-root' : 'scale-note');
          // find-tones: the anchoring root locates the shape.
          if (variant === 'find-tones') mark(p.anchor, 'scale-root');
          for (const pos of litCorrect) mark(pos, 'user-correct');
          if (wrongFlash) mark(wrongFlash, 'user-wrong');
          return out;
        })()
  );

  const chordLabel = $derived(currentPrompt ? chordName(NOTE_DISPLAY[currentPrompt.rootNote], currentPrompt.chord) : '');

  function shapeClass(s: CagedShape): string {
    if (nameCorrect === null || !currentPrompt) return s === pickedShape ? 'picked' : '';
    if (s === currentPrompt.shape) return 'right';
    return s === pickedShape ? 'wrong' : '';
  }
  function rootClass(n: Note): string {
    if (nameCorrect === null || !currentPrompt) return n === pickedRoot ? 'picked' : '';
    if (n === currentPrompt.rootNote) return 'right';
    return n === pickedRoot ? 'wrong' : '';
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
      {:else if variant === 'find-tones'}
        <strong>{chordLabel}</strong> — {currentPrompt.shape} shape
      {:else if variant === 'name-shape'}
        Which shape, and which root? <span class="quality">({CHORD_DISPLAY[currentPrompt.chord]})</span>
      {:else}
        In the {currentPrompt.fromShape} shape of <strong>{chordLabel}</strong> — play the
        <strong>{currentPrompt.shape} shape</strong> root{currentPrompt.expectedCount > 1 ? 's' : ''} up the neck
      {/if}
    </div>
    {#if variant !== 'name-shape'}
      <div class="progress">{litCorrect.length} / {currentPrompt?.expectedCount ?? 0}</div>
    {/if}
    {#if config.inputMode === 'mic'}
      <div class="mic" class:mic-error={micError !== null} role="status">
        {#if micError}{micError}
        {:else if strumMode}
          {#if strumState === 'recording'}● recording…
          {:else if strumState === 'analyzing'}{modelReady ? 'checking…' : 'loading the chord model (first time, ~1 MB)…'}
          {:else}🎸 strum the chord{lastHeard ? ` — heard ${lastHeard}` : ''}
            <button type="button" class="rec-now" disabled={awaitingAdvance || paused} onclick={() => strumCap?.trigger()}>Record now</button>
          {/if}
        {:else}🎤 listening{lastHeard ? ` — heard ${lastHeard}` : '…'}{/if}
      </div>
      {#if strumMode && strumFeedback}<div class="strum-feedback">{strumFeedback}</div>{/if}
    {/if}
    {#if config.inputMode === 'mic' && !strumMode}
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
        {#if config.inputMode === 'mic'}
          <div class="pause-mic">
            <MicSettings bind:sensitivity={micSensitivity} bind:deviceId={micDeviceId} devices={micDevices} />
          </div>
        {/if}
      </div>
    {/if}
  </div>

  {#if variant === 'name-shape' && !paused}
    <div class="choices" role="group" aria-label="Shape">
      {#each shapeChoices as s}
        <button type="button" class="choice {shapeClass(s)}" disabled={awaitingAdvance} onclick={() => pickName(s, null)}>{s} shape</button>
      {/each}
    </div>
    {#if config.fixedRootNote === null}
      <div class="choices" role="group" aria-label="Root">
        {#each CHROMATIC as n}
          <button type="button" class="choice small {rootClass(n)}" disabled={awaitingAdvance} onclick={() => pickName(null, n)}>{NOTE_DISPLAY[n]}</button>
        {/each}
      </div>
    {/if}
  {/if}

  {#if awaitingAdvance && !paused}
    <div class="continue-hint">
      {#if variant === 'name-shape' && currentPrompt}
        {nameCorrect ? 'Correct' : `It was the ${currentPrompt.shape} shape of ${chordLabel}`} — click anywhere to continue →
      {:else}
        Done — click anywhere to continue →
      {/if}
    </div>
  {/if}
</SessionShell>

<style>
  .target { font-size: 20px; }
  .quality { opacity: 0.8; }
  .progress { font-size: 18px; font-variant-numeric: tabular-nums; opacity: 0.85; }
  .mic { font-size: 14px; opacity: 0.85; }
  .rec-now { margin-left: 8px; padding: 2px 10px; font-size: 13px; border-radius: 6px; border: 1px solid #888; background: transparent; color: inherit; cursor: pointer; }
  .strum-feedback { font-size: 14px; }
  .mic-error { color: #e07a5f; opacity: 1; }
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
  .pause-mic {
    pointer-events: auto; margin-top: 16px; padding: 14px 18px;
    background: rgba(20, 16, 12, 0.92); border: 1px solid #4a3f33; border-radius: 8px; max-width: 440px;
  }
  .choices { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  .choice {
    padding: 12px 20px; font-size: 16px; border-radius: 8px;
    border: 1px solid #888; background: transparent; color: inherit; cursor: pointer;
  }
  .choice.small { padding: 8px 12px; font-size: 14px; }
  .choice:disabled { cursor: default; }
  .choice.picked { border-color: #ff8c42; box-shadow: inset 0 0 0 1px #ff8c42; }
  .choice.right { background: #5fb35a; color: #0a0a0a; border-color: #5fb35a; font-weight: 700; }
  .choice.wrong { background: #d65a3d; color: #0a0a0a; border-color: #d65a3d; font-weight: 700; }
  .continue-hint { text-align: center; font-size: 14px; opacity: 0.7; padding: 8px; animation: pulse 1.4s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
</style>
