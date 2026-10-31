// Metronome clicks, a held reference tone, and a look-ahead beat scheduler.
// Shared: Ideate's recorder and calibration use it; Learn rhythm exercises can too.
import { midiToHz } from './pitchMath';

// One click at `time` (AudioContext seconds). Accent = downbeat (higher pitch). vol 0..1.
export function scheduleClick(ctx: BaseAudioContext, time: number, accent: boolean, vol: number): void {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = accent ? 1600 : 1000;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.6 * vol), time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  o.connect(g).connect(ctx.destination);
  o.start(time);
  o.stop(time + 0.06);
}

// A sustained sine reference pitch from `time` for `dur` seconds, ramped in and out.
export function scheduleTone(ctx: BaseAudioContext, time: number, midi: number, dur: number): void {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = midiToHz(midi);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.35, time + 0.03);
  g.gain.setValueAtTime(0.35, Math.max(time + 0.04, time + dur - 0.1));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  o.connect(g).connect(ctx.destination);
  o.start(time);
  o.stop(time + dur + 0.02);
}

// Beat length in seconds: bpm counts quarter notes, den is the beat value (x/8 beats are eighths).
export const beatSeconds = (bpm: number, den: number): number => (60 / bpm) * (4 / den);

export interface MetronomeOptions {
  bpm: number;
  num: number; // beats per bar (accent every num)
  den: number;
  startAt: number; // AudioContext time of beat 0
  clickBeat: (beat: number) => boolean; // whether beat `beat` (0-based) clicks
  volume: () => number; // read per click, so a slider updates live
  onBeat?: (beat: number, delayMs: number) => void; // UI hook, called ahead of time with the delay until the beat
}

// Look-ahead scheduler (25ms timer, 100ms horizon). Returns stop().
export function startMetronome(ctx: BaseAudioContext, o: MetronomeOptions): () => void {
  const beatSec = beatSeconds(o.bpm, o.den);
  let next = o.startAt, beat = 0;
  const tick = () => {
    while (next < ctx.currentTime + 0.1) {
      if (o.clickBeat(beat)) scheduleClick(ctx, next, beat % o.num === 0, o.volume());
      o.onBeat?.(beat, Math.max(0, (next - ctx.currentTime) * 1000));
      next += beatSec;
      beat++;
    }
  };
  tick();
  const id = setInterval(tick, 25);
  return () => clearInterval(id);
}
