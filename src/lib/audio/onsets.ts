// Amplitude onsets for rhythm judging: when a note starts, not which note. The pitch
// listener (pitch.ts) waits for a stable pitch over several 2048-sample frames, so its
// onset time is late by a variable amount; here the attack is timed to one 256-sample
// block (~5 ms) from the analyser window, in AudioContext time.
import { getAudioContext } from './context';
import { openMic } from './pitch';
import { rmsFloorForSensitivity, DEFAULT_MIC_SENSITIVITY } from './pitchMath';

const BLOCK = 256;
const HISTORY = 4;     // blocks of baseline (~21 ms: more than one low-E period, so no ripple)
const RATIO = 1.4;     // peak must jump this much over the recent maximum
const REFRACTORY = 0.08; // s; a pluck's own ringing never re-triggers within this

// Feed it the newest analyser window and the time of its last sample. Windows may
// overlap (each sample is judged once) or skip samples (dropped frames).
export class AmpOnsetDetector {
  private next = -Infinity; // absolute sample index of the next unjudged block
  private hist: number[] = [];
  private last = -Infinity;
  constructor(private readonly sr: number, private floor: number) {}

  setFloor(floor: number) { this.floor = floor; }

  push(buf: Float32Array, endT: number): number[] {
    const end = Math.round(endT * this.sr), start = end - buf.length, out: number[] = [];
    let b = Math.max(this.next, Math.ceil(start / BLOCK) * BLOCK);
    for (; b + BLOCK <= end; b += BLOCK) {
      let peak = 0;
      for (let j = b - start; j < b - start + BLOCK; j++) peak = Math.max(peak, Math.abs(buf[j]));
      const t = b / this.sr, base = this.hist.length ? Math.max(...this.hist) : 0;
      if (peak >= this.floor && peak > RATIO * base && t - this.last >= REFRACTORY) {
        out.push(t);
        this.last = t;
      }
      this.hist.push(peak);
      if (this.hist.length > HISTORY) this.hist.shift();
    }
    this.next = b;
    return out;
  }
}

// A tap (key or pointer event) in AudioContext time, as heard: getOutputTimestamp maps
// the sample now leaving the speakers to performance.now(), so output latency is removed.
export function eventToCtxTime(ctx: AudioContext, eventTimeStamp: number): number {
  const ts = ctx.getOutputTimestamp?.();
  if (!ts?.performanceTime || ts.contextTime === undefined) return ctx.currentTime;
  return ts.contextTime + (eventTimeStamp - ts.performanceTime) / 1000;
}

export interface OnsetListener { stop(): void; setSensitivity(s: number): void }

// Opens the mic and calls onOnset(ctxTime) per attack. Rejects when the mic is unavailable.
export async function startOnsetListener(
  onOnset: (t: number) => void,
  opts: { sensitivity?: number; deviceId?: string | null } = {}
): Promise<OnsetListener> {
  const ctx = getAudioContext();
  if (!ctx) throw new Error('audio context unavailable');
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* ignore */ } }
  // Echo cancellation keeps the speaker's clicks out; AGC and noise suppression flatten attacks.
  const stream = await openMic(opts.deviceId, { echoCancellation: true, autoGainControl: false, noiseSuppression: false });
  const source = ctx.createMediaStreamSource(stream);
  // Low-pass: the metronome clicks are 1 and 1.6 kHz sines; a pluck has plenty below.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 600;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(lp).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const floorFor = (s?: number) => rmsFloorForSensitivity(s ?? DEFAULT_MIC_SENSITIVITY) * 2; // a peak, not an RMS
  const det = new AmpOnsetDetector(ctx.sampleRate, floorFor(opts.sensitivity));
  let raf = 0, stopped = false;
  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(buf);
    for (const t of det.push(buf, ctx.currentTime)) { try { onOnset(t); } catch { /* keep listening */ } }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      try { source.disconnect(); } catch { /* ignore */ }
      stream.getTracks().forEach(t => t.stop());
    },
    setSensitivity(s: number) { det.setFloor(floorFor(s)); }
  };
}
