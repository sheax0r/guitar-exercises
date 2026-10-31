// "Strum it" mic mode: capture a short take of a strummed chord, then judge its
// pitch-class set. Capture is pitchy-free raw PCM; the polyphonic detection
// (Basic Pitch) is loaded by the caller only when this mode is used.
import { getAudioContext } from './context';
import { openMic } from './pitch';
import { rms, rmsFloorForSensitivity, DEFAULT_MIC_SENSITIVITY, MIN_GUITAR_MIDI, MAX_GUITAR_MIDI } from './pitchMath';
import type { RawNote } from '../transcribe/types';

export const TAKE_SEC = 2;
const PRE_ROLL_SEC = 0.15; // keep the attack that tripped the onset gate

// Collects one take from a stream of PCM blocks. Armed, it waits for a quiet
// block (so the previous chord's ring-out can't trip it), then starts on the
// first block over the loudness floor, or at once on trigger(). Returns the
// take (pre-roll + TAKE_SEC) when full, then disarms.
export class TakeCapture {
  private pre: Float32Array[] = [];
  private take: Float32Array[] | null = null;
  private got = 0;
  private armed = false;
  private sawQuiet = false;
  floor: number;

  constructor(readonly sampleRate: number, sensitivity = DEFAULT_MIC_SENSITIVITY) {
    this.floor = rmsFloorForSensitivity(sensitivity);
  }

  get recording(): boolean { return this.take !== null; }

  arm(): void { this.armed = true; this.sawQuiet = false; this.take = null; this.got = 0; }
  disarm(): void { this.armed = false; this.take = null; }
  trigger(): void { if (this.armed && !this.take) this.begin(); }

  push(block: Float32Array): Float32Array | null {
    const b = Float32Array.from(block);
    if (this.take) {
      this.take.push(b);
      this.got += b.length;
      if (this.got < TAKE_SEC * this.sampleRate) return null;
      const out = concat(this.take);
      this.armed = false;
      this.take = null;
      return out;
    }
    if (this.armed) {
      const loud = rms(b) >= this.floor;
      if (!loud) this.sawQuiet = true;
      else if (this.sawQuiet) { this.begin(); return this.push(b); }
    }
    this.pre.push(b);
    let n = this.pre.reduce((s, x) => s + x.length, 0);
    while (this.pre.length > 1 && n - this.pre[0].length >= PRE_ROLL_SEC * this.sampleRate) n -= this.pre.shift()!.length;
    return null;
  }

  private begin() {
    this.take = [...this.pre];
    this.got = 0;
    this.pre = [];
  }
}

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Detected notes -> the chord's sounding pitches (MIDI, ascending). Basic Pitch
// also reports faint notes (ring-over, sympathetic strings); keep notes within
// the guitar range at least 30% as loud as the loudest.
export function strumPitches(notes: RawNote[]): number[] {
  const max = Math.max(0, ...notes.map(n => n.amp ?? 1));
  return notes
    .filter(n => (n.amp ?? 1) >= 0.3 * max)
    .map(n => Math.round(n.midiFloat))
    .filter(m => m >= MIN_GUITAR_MIDI && m <= MAX_GUITAR_MIDI)
    .sort((a, b) => a - b);
}

export interface StrumVerdict {
  correct: boolean;
  missing: number[]; // chord pitch classes not heard
  extra: number[]; // heard pitch classes not in the chord
  bassPc: number | null; // lowest heard pitch class
  bassOk: boolean; // true when no bass is required
}

// The heard pitch-class set must equal the chord's; with `bass` set, the lowest
// heard note must also be that pitch class.
export function judgeStrum(midis: number[], chordPcs: number[], bass: number | null = null): StrumVerdict {
  const pcs = new Set(midis.map(m => ((m % 12) + 12) % 12));
  const want = new Set(chordPcs.map(p => ((p % 12) + 12) % 12));
  const missing = [...want].filter(p => !pcs.has(p));
  const extra = [...pcs].filter(p => !want.has(p));
  const bassPc = midis.length ? ((Math.min(...midis) % 12) + 12) % 12 : null;
  const bassOk = bass === null || bassPc === bass;
  return { correct: missing.length === 0 && extra.length === 0 && bassOk, missing, extra, bassPc, bassOk };
}

export interface StrumCapture {
  arm(): void;
  disarm(): void;
  trigger(): void;
  setSensitivity(s: number): void;
  stop(): void;
}

// Opens the mic and feeds a TakeCapture. onTake gets each finished take;
// onRecording reports when a take starts.
export async function startStrumCapture(
  onTake: (data: Float32Array, sampleRate: number) => void,
  opts: { sensitivity?: number; deviceId?: string | null; onRecording?: () => void } = {}
): Promise<StrumCapture> {
  const ctx = getAudioContext();
  if (!ctx) throw new Error('audio context unavailable');
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* ignore */ } }
  const stream = await openMic(opts.deviceId);
  const cap = new TakeCapture(ctx.sampleRate, opts.sensitivity);
  // ponytail: ScriptProcessorNode is deprecated but works everywhere without a
  // separate worklet module; move to an AudioWorklet if it is ever removed.
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const sink = ctx.createGain();
  sink.gain.value = 0; // the processor must reach the destination to run; keep it silent
  let wasRecording = false;
  proc.onaudioprocess = e => {
    const take = cap.push(e.inputBuffer.getChannelData(0));
    if (cap.recording && !wasRecording) opts.onRecording?.();
    wasRecording = cap.recording;
    if (take) onTake(take, ctx.sampleRate);
  };
  src.connect(proc);
  proc.connect(sink);
  sink.connect(ctx.destination);
  return {
    arm: () => cap.arm(),
    disarm: () => cap.disarm(),
    trigger: () => cap.trigger(),
    setSensitivity: s => { cap.floor = rmsFloorForSensitivity(s); },
    stop() {
      proc.onaudioprocess = null;
      try { src.disconnect(); proc.disconnect(); sink.disconnect(); } catch { /* ignore */ }
      stream.getTracks().forEach(t => t.stop());
    }
  };
}
