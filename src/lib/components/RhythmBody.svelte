<script lang="ts">
  import { untrack } from 'svelte';
  import SessionShell from './SessionShell.svelte';
  import MicSettings from './MicSettings.svelte';
  import { drawBars, gridTargets, scoreRhythm, PATTERNS } from '../exercise/rhythm/rhythm';
  import type { GridTarget, RhythmConfig, RhythmReport } from '../exercise/rhythm/types';
  import { RHYTHM_TARGET_LABEL } from '../exercise/summary';
  import { startMetronome } from '../audio/metronome';
  import { loadCalibMs, hasCalib } from '../audio/calibration';
  import { getAudioContext } from '../audio/context';
  import { startOnsetListener, eventToCtxTime, type OnsetListener } from '../audio/onsets';
  import { listAudioInputs } from '../audio/pitch';

  type Props = {
    config: RhythmConfig;
    onComplete: (report: RhythmReport) => void;
    onAbort: (report: RhythmReport) => void;
  };
  let { config, onComplete, onAbort }: Props = $props();

  const cfg = untrack(() => config);
  const mic = cfg.inputMode === 'mic';
  // Input arrives late by the round-trip latency; the offset (negative) pulls it back.
  const calibMs = mic ? loadCalibMs() : 0;
  const calibrated = !mic || hasCalib();
  const bars = drawBars(cfg.target, cfg.bars);
  const beatSec = 60 / cfg.bpm, barSec = 4 * beatSec;
  // Bars split half an eighth before their downbeat, so an early beat 1 counts for its bar.
  const lead = beatSec / 4;

  // Bars < barsDone are scored. The bar being played is dropped on pause and replayed.
  let targets: GridTarget[] = [];
  let onsets: Array<{ t: number; bar: number }> = [];
  let run: { first: number; start: number } | null = null;
  let barsDone = $state(0);
  let curBar = $state<number | null>(null); // -1 = count-in
  let beat = $state<number | null>(null);
  let report = $state<RhythmReport>(scoreRhythm([], [], cfg.toleranceMs, calibMs));
  let lastBar = $state<{ index: number; slots: Array<{ slot: number; errorMs: number | null }>; extras: number } | null>(null);
  let heard = $state(0); // bumps per onset, for the flash
  let paused = $state(false);
  let needsTap = $state(false);
  let finished = false;

  const scored = (n: number) => scoreRhythm(
    targets.filter(t => t.bar < n), onsets.filter(o => o.bar < n).map(o => o.t), cfg.toleranceMs, calibMs);

  function endSession(soft: boolean) {
    finished = true;
    const r = scored(barsDone);
    if (soft) onComplete(r); else onAbort(r);
  }

  function finishBar(k: number) {
    if (finished || k < barsDone) return;
    barsDone = k + 1;
    report = scored(barsDone);
    const mine = report.results.filter(r => r.bar === k);
    lastBar = {
      index: k,
      slots: bars[k].map((slot, i) => ({ slot, errorMs: mine[i]?.errorMs ?? null })),
      extras: onsets.filter(o => o.bar === k).length - mine.filter(r => r.errorMs !== null).length
    };
    if (barsDone >= cfg.bars) endSession(true);
  }

  // t: when the note was played, in AudioContext seconds (already latency-corrected).
  function recordOnset(t: number) {
    if (paused || !run || finished) return;
    const bar = run.first + Math.floor((t - run.start + lead) / barSec);
    if (bar < Math.max(run.first, barsDone) || bar >= cfg.bars) return; // count-in, or after the end
    onsets.push({ t, bar });
    heard += 1;
  }

  // --- Metronome: one bar of count-in, then the bars left -------------------
  $effect(() => {
    if (paused) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const resume = () => { ctx.resume().then(() => { needsTap = false; }).catch(() => { /* ignore */ }); };
    if (ctx.state === 'suspended') { needsTap = true; resume(); }
    window.addEventListener('pointerdown', resume, { once: true });
    const first = untrack(() => barsDone);
    const startAt = ctx.currentTime + 0.2;
    run = { first, start: startAt + barSec };
    targets = targets.filter(t => t.bar < first).concat(gridTargets(bars.slice(first), run.start, cfg.bpm, first));
    const left = cfg.bars - first;
    // Score a bar once its late hits (and the input latency) have come in.
    const settleMs = cfg.toleranceMs + Math.max(0, -calibMs) + 100;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let live = true; // a stopped run schedules nothing more
    const later = (ms: number, f: () => void) => { if (live) timers.push(setTimeout(f, Math.max(0, ms))); };
    const stop = startMetronome(ctx, {
      bpm: cfg.bpm, num: 4, den: 4, startAt,
      clickBeat: b => b < 4 * (left + 1),
      volume: () => 0.6,
      onBeat: (b, delayMs) => {
        const bar = b < 4 ? -1 : first + Math.floor((b - 4) / 4);
        if (bar < cfg.bars) later(delayMs, () => { beat = b < 4 ? b - 4 : b % 4; curBar = bar; });
        if (b >= 8 && b % 4 === 0 && bar <= cfg.bars) later(delayMs + settleMs, () => finishBar(bar - 1));
      }
    });
    return () => {
      live = false;
      stop();
      timers.forEach(clearTimeout);
      window.removeEventListener('pointerdown', resume);
      // The unfinished bar is replayed after the next count-in.
      const done = untrack(() => barsDone);
      targets = targets.filter(t => t.bar < done);
      onsets = onsets.filter(o => o.bar < done);
      run = null;
      beat = null;
      curBar = null;
    };
  });

  // --- Input ------------------------------------------------------------------
  let micError = $state<string | null>(null);
  let micSensitivity = $state(cfg.micSensitivity);
  let micDeviceId = $state(cfg.micDeviceId);
  let micDevices = $state<Array<{ deviceId: string; label: string }>>([]);
  let listener: OnsetListener | null = null;
  const tapping = $derived(!mic || micError !== null);

  $effect(() => {
    if (!mic) return;
    const deviceId = micDeviceId;
    let cancelled = false;
    startOnsetListener(t => { if (!cancelled) recordOnset(t + calibMs / 1000); },
      { sensitivity: untrack(() => micSensitivity), deviceId })
      .then(l => {
        if (cancelled) { l.stop(); return; }
        listener = l;
        micError = null;
        listAudioInputs().then(d => { micDevices = d; });
      })
      .catch(() => { micError = 'Microphone unavailable — tap a key or the pad instead.'; });
    return () => { cancelled = true; listener?.stop(); listener = null; };
  });
  $effect(() => { listener?.setSensitivity(micSensitivity); });

  // Taps: any key but space (pause), or the pad. Timed against what was audible.
  function tap(e: Event) {
    const ctx = getAudioContext();
    if (ctx) recordOnset(eventToCtxTime(ctx, e.timeStamp));
  }
  $effect(() => {
    if (!tapping) return;
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.key === ' ' || e.code === 'Space' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
      tap(e);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const SLOTS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
  const SLOT_LABEL = ['1', '&', '2', '&', '3', '&', '4', '&'];
  const showBar = $derived(curBar !== null && curBar >= 0 ? curBar : Math.min(barsDone, cfg.bars - 1));
  const patternName = $derived(cfg.target === 'pattern' ? PATTERNS.find(p => p.slots === bars[showBar])?.name : null);
  const fmt = (ms: number) => `${ms > 0 ? '+' : ''}${ms} ms`;
</script>

<SessionShell
  durationSec={0}
  continuous={true}
  correctCount={report.correctCount}
  incorrectCount={report.incorrectCount}
  onEnd={endSession}
  bind:paused
>
  {#snippet headerExtra()}
    <div class="target">
      {#if curBar === null || curBar < 0}
        {needsTap ? 'Click anywhere to start the count-in' : 'Count-in…'}
      {:else}
        Bar <strong>{curBar + 1}</strong> / {cfg.bars}
      {/if}
      <span class="what">— play {RHYTHM_TARGET_LABEL[cfg.target].toLowerCase()}{patternName ? ` (${patternName})` : ''}, {cfg.bpm} bpm</span>
    </div>
    <div class="beats" aria-label="Beat">
      {#each [0, 1, 2, 3] as i}<span class="dot" class:on={beat === i} class:count={beat !== null && beat < 0 && beat + 4 === i}></span>{/each}
    </div>
    <div class="mic" class:mic-error={micError !== null}>
      {#if micError}{micError}
      {:else if mic}🎤 listening{calibrated ? ` · latency ${calibMs} ms` : ' · not calibrated'}
      {:else}Tap any key (not space) or the pad{/if}
    </div>
  {/snippet}

  <div class="board" class:paused>
    <div class="grid" aria-label="This bar">
      {#each SLOTS as s, i}
        <div class="slot" class:hit={bars[showBar].includes(s)} class:now={beat !== null && beat >= 0 && beat * 2 === i}>
          <span class="mark"></span>
          <span class="lbl">{SLOT_LABEL[i]}</span>
        </div>
      {/each}
    </div>
    {#key heard}<div class="heard" class:flash={heard > 0} aria-hidden="true"></div>{/key}

    {#if lastBar}
      <div class="feedback" aria-label="Last bar">
        Bar {lastBar.index + 1}:
        {#each lastBar.slots as r}
          <span class={r.errorMs === null ? 'miss' : 'ok'}>
            {SLOT_LABEL[r.slot * 2]}{r.errorMs === null ? ' miss' : ` ${fmt(r.errorMs)}`}
          </span>
        {/each}
        {#if lastBar.extras > 0}<span class="miss">{lastBar.extras} extra</span>{/if}
      </div>
    {/if}
    {#if report.meanAbsMs !== null}
      <div class="running">Average error {report.meanAbsMs} ms{report.biasMs ? `, ${Math.abs(report.biasMs)} ms ${report.biasMs > 0 ? 'late' : 'early'} on average` : ''}</div>
    {/if}

    {#if tapping}
      <button type="button" class="pad" onpointerdown={tap}>Tap</button>
    {/if}

    {#if paused}
      <div class="paused-overlay">
        <div class="paused-text">Paused</div>
        <div class="paused-hint">The unfinished bar starts again after a count-in.</div>
        {#if mic}
          <div class="pause-mic">
            <MicSettings bind:sensitivity={micSensitivity} bind:deviceId={micDeviceId} devices={micDevices} />
          </div>
        {/if}
      </div>
    {/if}
  </div>
</SessionShell>

<style>
  .target { font-size: 20px; }
  .what { opacity: 0.75; font-size: 16px; }
  .beats { display: flex; gap: 6px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid #888; }
  .dot.on { background: #ff8c42; border-color: #ff8c42; }
  .dot.count { background: #888; }
  .mic { font-size: 14px; opacity: 0.85; }
  .mic-error { color: #e07a5f; opacity: 1; }
  .board { background: #2a2018; padding: 24px; border-radius: 8px; position: relative; display: flex; flex-direction: column; gap: 18px; align-items: center; }
  .grid { display: grid; grid-template-columns: repeat(8, minmax(28px, 56px)); gap: 6px; }
  .slot { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 0; border-radius: 6px; }
  .slot.now { background: rgba(255, 140, 66, 0.15); }
  .mark { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #555; }
  .slot.hit .mark { background: #ff8c42; border-color: #ff8c42; }
  .lbl { font-size: 14px; opacity: 0.8; }
  .heard { width: 10px; height: 10px; border-radius: 50%; background: transparent; }
  .heard.flash { animation: flash 0.25s ease-out; }
  @keyframes flash { from { background: #5fb35a; } to { background: transparent; } }
  .feedback { display: flex; flex-wrap: wrap; gap: 10px; font-size: 15px; justify-content: center; }
  .ok { color: #5fb35a; }
  .miss { color: #e07a5f; }
  .running { font-size: 14px; opacity: 0.8; }
  .pad { width: min(280px, 100%); height: 96px; font-size: 22px; font-weight: 700; border-radius: 12px; touch-action: manipulation; }
  .board.paused .grid { filter: blur(2px) brightness(0.6); }
  .paused-overlay {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.35); pointer-events: none;
  }
  .paused-text { font-size: 48px; font-weight: 700; color: rgba(232, 227, 211, 0.7); }
  .paused-hint { font-size: 14px; opacity: 0.8; color: #cfc6b3; }
  .pause-mic {
    pointer-events: auto; margin-top: 16px; padding: 14px 18px;
    background: rgba(20, 16, 12, 0.92); border: 1px solid #4a3f33; border-radius: 8px; max-width: 440px;
  }
</style>
