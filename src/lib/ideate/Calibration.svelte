<script lang="ts">
  // Latency calibration: plays 8 beats, measures mic/output lag, saves it as the default
  // timing offset for new jobs (and applies it to the open job).
  import { calibrate, saveCalibMs } from '../audio/calibration';
  import { openMic } from '../audio/pitch';
  import { settings, ui, audioCtx, flashBeat } from './state.svelte';

  let { onCalibrated }: { onCalibrated?: (ms: number) => void } = $props();

  let mode = $state<'clicks' | 'tap'>('clicks');
  let busy = $state(false);
  let out = $state('');

  async function run() {
    if (ui.recording || busy) return;
    let stream: MediaStream;
    let ctx: AudioContext;
    try {
      ctx = audioCtx();
      stream = await openMic(settings.deviceId);
    } catch (err) {
      out = 'mic unavailable: ' + ((err as Error).name || err);
      return;
    }
    busy = true;
    out = mode === 'tap' ? 'tap each beat…' : 'listening to clicks…';
    try {
      await ctx.resume();
      const ms = await calibrate(ctx, stream, {
        bpm: settings.bpm, num: settings.num, den: settings.den, volume: settings.metroVol,
        onBeat: (k, delay) => flashBeat(k + 1, delay, 120)
      });
      if (ms == null) {
        out = mode === 'tap' ? 'no clear beat: tap on each click' : 'no clear beat: turn clicks up';
        return;
      }
      ui.calibMs = ms;
      saveCalibMs(ms);
      onCalibrated?.(ms);
      out = `calibrated: offset ${ms >= 0 ? '+' : ''}${ms} ms (applied and saved as default)`;
    } catch (e) {
      console.warn('calibration failed:', e);
      out = 'analysis failed';
    } finally {
      stream.getTracks().forEach(t => t.stop());
      busy = false;
      ui.flash = null;
    }
  }
</script>

<div class="row">
  <span class="label">Latency calibration</span>
  <div class="chips">
    <select bind:value={mode} aria-label="Calibration capture mode">
      <option value="clicks">listen to clicks (speakers)</option>
      <option value="tap">tap along (headphones)</option>
    </select>
    <button type="button" class="chip" disabled={busy} onclick={run}>Calibrate</button>
  </div>
  {#if out}<span class="hint" role="status">{out}</span>{/if}
  <span class="hint">Plays 8 beats, measures mic/output lag, and sets the timing offset for new recordings
    (now {ui.calibMs >= 0 ? '+' : ''}{ui.calibMs} ms).</span>
</div>

<style>
  select { padding: 6px; max-width: 100%; }
</style>
