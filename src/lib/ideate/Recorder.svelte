<script lang="ts">
  // REC / STOP with count-in (flashed beats + a held reference tone), metronome while
  // recording, a level meter and a live tuner. STOP queues the take as a job.
  import { PitchDetector } from 'pitchy';
  import { onDestroy } from 'svelte';
  import { openMic } from '../audio/pitch';
  import { hzToMidiFloat } from '../audio/pitchMath';
  import { beatSeconds, scheduleTone, startMetronome } from '../audio/metronome';
  import { INSTR } from '../transcribe/detect';
  import { noteName } from '../transcribe/fretting';
  import { settings, ui, enqueue, audioCtx, flashBeat } from './state.svelte';

  let { onMicOpened }: { onMicOpened?: () => void } = $props();

  let media: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let stopMetro: (() => void) | null = null;
  let meterRaf = 0;
  let level = $state(0);
  let tuner = $state<{ note: string; cents: number } | null>(null);

  function startMeter(ctx: AudioContext, s: MediaStream) {
    const src = ctx.createMediaStreamSource(s), an = ctx.createAnalyser();
    an.fftSize = 2048;
    src.connect(an);
    const buf = new Float32Array(an.fftSize), det = PitchDetector.forFloat32Array(an.fftSize);
    const loop = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const x of buf) sum += x * x;
      level = Math.min(100, Math.sqrt(sum / buf.length) * 300);
      const [hz, clar] = det.findPitch(buf, ctx.sampleRate), c = INSTR[settings.instrument];
      if (clar > 0.9 && hz > c.lo && hz < c.hi) {
        const m = hzToMidiFloat(hz);
        tuner = { note: noteName(Math.round(m)), cents: Math.round((m - Math.round(m)) * 100) };
      } else tuner = null;
      meterRaf = requestAnimationFrame(loop);
    };
    loop();
    return () => src.disconnect();
  }
  let stopMeterSrc: (() => void) | null = null;
  function stopMeter() {
    cancelAnimationFrame(meterRaf);
    stopMeterSrc?.();
    stopMeterSrc = null;
    level = 0;
    tuner = null;
  }

  function release() {
    stopMetro?.();
    stopMetro = null;
    stopMeter();
    ui.flash = null;
  }

  async function toggle() {
    if (ui.recording) {
      ui.recording = false;
      const wasRec = media?.state === 'recording';
      if (wasRec) media!.stop(); // onstop -> enqueue + release mic
      else stream?.getTracks().forEach(t => t.stop()); // stopped during count-in: just release the mic
      release();
      ui.status = wasRec ? 'queued, see Jobs' : 'cancelled';
      return;
    }
    let ctx: AudioContext;
    try {
      ctx = audioCtx();
      stream = await openMic(settings.deviceId);
    } catch (err) {
      ui.status = 'mic unavailable: ' + ((err as Error).name || err);
      return;
    }
    onMicOpened?.(); // device labels are available now that permission is granted
    const s = stream;
    const rec = (media = new MediaRecorder(s));
    const chunks: Blob[] = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      s.getTracks().forEach(t => t.stop());
      enqueue(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), 'Recording ' + new Date().toLocaleTimeString());
    };
    ui.recording = true;
    await ctx.resume();
    stopMeterSrc = startMeter(ctx, s);

    const { bpm, num, den } = settings, beatSec = beatSeconds(bpm, den);
    const countBeats = settings.countIn ? num : 0;
    const startAt = ctx.currentTime + 0.2, recAt = startAt + countBeats * beatSec;
    setTimeout(() => {
      if (ui.recording && media === rec) {
        rec.start();
        ui.flash = null;
        ui.status = 'recording…';
      }
    }, Math.max(0, (recAt - ctx.currentTime) * 1000));
    ui.status = countBeats ? 'count-in…' : 'recording…';
    if (countBeats && settings.playPitch) scheduleTone(ctx, startAt, settings.startNote, countBeats * beatSec); // one held reference
    stopMetro = startMetronome(ctx, {
      bpm, num, den, startAt,
      clickBeat: b => settings.metro || b < countBeats,
      volume: () => settings.metroVol,
      onBeat: (b, delay) => { if (b < countBeats) flashBeat(b + 1, delay); }
    });
  }

  onDestroy(() => {
    if (ui.recording) {
      ui.recording = false;
      if (media?.state === 'recording') media.stop();
      else stream?.getTracks().forEach(t => t.stop());
    }
    release();
  });

  function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    if (!f) return;
    enqueue(f, f.name);
    ui.status = 'queued, see Jobs';
    input.value = ''; // allow re-selecting the same file
  }
</script>

<div class="recorder">
  <div class="recwrap">
    <button type="button" class="rec" class:on={ui.recording} onclick={toggle} aria-label={ui.recording ? 'Stop recording' : 'Record'}>
      {ui.recording ? '■ STOP' : '● REC'}
    </button>
    {#if ui.flash !== null}<div class="flash" aria-live="polite">{ui.flash}</div>{/if}
  </div>
  <div class="tuner" class:intune={tuner && Math.abs(tuner.cents) <= 15} class:off={tuner && Math.abs(tuner.cents) > 15}>
    <span class="tnote">{tuner?.note ?? '–'}</span>
    <span class="tcents">{tuner ? (tuner.cents > 0 ? '+' : '') + tuner.cents + '¢' : ''}</span>
  </div>
  <div class="meter"><div class="meterbar" style:width="{level}%"></div></div>
  <span class="status" role="status">{ui.status}</span>
  <label class="hint upload">or transcribe a file:
    <input type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac" onchange={onFile} aria-label="Audio file to transcribe" />
  </label>
</div>

<style>
  .recorder { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .recwrap { position: relative; }
  .rec {
    width: 120px; height: 120px; border-radius: 50%; border: none;
    background: #ff8c42; color: #1a1a1a; font-size: 18px; font-weight: 700; cursor: pointer;
  }
  .rec.on { background: #444; color: #fff; }
  .flash {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 72px; font-weight: 800; pointer-events: none; color: #fff;
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.6);
  }
  .tuner { height: 44px; display: flex; align-items: baseline; justify-content: center; gap: 10px; }
  .tnote { font-size: 32px; font-weight: 800; }
  .tcents { font-size: 16px; opacity: 0.7; min-width: 60px; }
  .tuner.intune { color: #2e9e3a; }
  .tuner.off { color: #d97a00; }
  .meter { height: 8px; width: 200px; max-width: 100%; background: rgba(136, 136, 136, 0.35); border-radius: 4px; overflow: hidden; }
  .meterbar { height: 100%; background: #ff8c42; transition: width 0.05s; }
  .status { opacity: 0.7; min-height: 1.2em; text-align: center; }
  .upload { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: center; max-width: 100%; }
  .upload input { max-width: 100%; }
</style>
