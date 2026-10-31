// Deterministic synthetic performances of a melody -> mono Float32Array, for golden fixtures.
// timbre: whistle (near-pure sine + vibrato + breath), hum (harmonic stack, low), guitar
// (Karplus-Strong plucks). humanize 0..1: per-note detune, timing jitter, global sharp drift,
// breath noise. Seeded, so output is reproducible. Notes are mixed (+=), so a jittered note
// overlapping the previous release doesn't cut it off.
import { midiToHz } from '../../audio/pitchMath';
import { withPos, type Song } from './songs';

export interface SynthOptions {
  bpm?: number;
  base?: number;
  timbre?: 'whistle' | 'hum' | 'guitar';
  sr?: number;
  humanize?: number;
  seed?: number;
  lead?: number;
}

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function synthMelody(
  song: Song,
  { bpm = 100, base = 79, timbre = 'whistle', sr = 44100, humanize = 0, seed = 1, lead = 0.5 }: SynthOptions = {}
): Float32Array {
  const r = rng(seed), beat = 60 / bpm, notes = withPos(song);
  const total = lead + notes.reduce((s, n) => s + n.beats, 0) * beat + 1, out = new Float32Array(Math.ceil(total * sr));
  const drift = humanize * 0.2; // whole-take sharpness in semitones (whistlers run sharp)
  for (const n of notes) {
    const t0 = lead + n.pos * beat + humanize * (r() - 0.5) * 0.04; // up to +-20ms timing jitter
    // sung/whistled notes leave a breath gap
    const len = n.beats * beat * (timbre === 'guitar' ? 1 : 0.88) - (timbre === 'guitar' ? 0.01 : 0);
    const f = midiToHz(base + n.semi + drift + humanize * (r() - 0.5) * 0.2), i0 = Math.round(t0 * sr), N = Math.round(len * sr);
    if (timbre === 'guitar') {
      // Karplus-Strong: noise burst through a damped delay line
      const D = Math.max(2, Math.round(sr / f - 0.5)), buf = new Float32Array(D);
      for (let k = 0; k < D; k++) buf[k] = r() * 2 - 1;
      const dc = buf.reduce((s, v) => s + v, 0) / D;
      for (let k = 0; k < D; k++) buf[k] -= dc; // zero-mean burst: KS keeps DC, real strings don't
      for (let k = 0, p = 0; k < N && i0 + k < out.length; k++, p = (p + 1) % D) {
        const q = (p + 1) % D, v = buf[p];
        buf[p] = 0.996 * 0.5 * (buf[p] + buf[q]);
        out[i0 + k] += 0.5 * v * Math.min(1, (N - k) / (0.01 * sr)); // 10ms damp before the next pluck
      }
      continue;
    }
    let ph = 0;
    const vibDepth = timbre === 'hum' ? 0.003 : 0.004 * (0.5 + humanize * 0.5), H = timbre === 'hum' ? 10 : 1;
    for (let k = 0; k < N && i0 + k < out.length; k++) {
      const t = k / sr, env = Math.min(1, t / (timbre === 'hum' ? 0.04 : 0.02), (N - k) / (0.03 * sr));
      ph += (2 * Math.PI * f * (1 + vibDepth * Math.sin(2 * Math.PI * 5.5 * t))) / sr;
      let s = 0;
      for (let h = 1; h <= H; h++) s += Math.sin(h * ph) / Math.pow(h, 1.5);
      out[i0 + k] += 0.4 * env * s + humanize * 0.01 * env * (r() * 2 - 1);
    }
  }
  return out;
}
