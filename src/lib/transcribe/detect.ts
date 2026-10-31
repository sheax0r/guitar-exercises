// Detection: audio -> raw notes (pitchy monophonic, or Basic Pitch polyphonic), plus latency
// calibration against a click track. Pure: no DOM, no globals.
import { PitchDetector } from 'pitchy';
import { hzToMidiFloat } from '../audio/pitchMath';
import { median } from './quantize';
import type { AudioLike, DetectSettings, Instrument, RawNote } from './types';

// Per input: detection pitch range (Hz), whether pitch is reliable enough to transcribe
// absolute, and the default start (reference) note.
export const INSTR: Record<Instrument, { lo: number; hi: number; absolute: boolean; start: number }> = {
  guitar: { lo: 75, hi: 1400, absolute: true, start: 40 }, // low E; reliable pitch -> keep actual notes
  whistle: { lo: 200, hi: 4000, absolute: false, start: 72 }, // high register (C5); anchor to start note
  humming: { lo: 80, hi: 1000, absolute: false, start: 48 }, // low (C3)
  singing: { lo: 80, hi: 1200, absolute: false, start: 57 } // mid (A3)
};

// Basic Pitch is polyphonic and also reports quieter overtone "ghosts" of each note.
// mono (voice, whistle): one note at a time -> drop the quieter of two notes overlapping by
//   more than half the shorter; a smaller (legato) overlap just ends the earlier note where
//   the next one starts.
// guitar (may play chords): drop a quieter (< 0.85x) note an octave / 12th / two octaves
//   above a note starting with it, or a much quieter (< 0.6x) note on a higher harmonic
//   (partials 2-10) of a note already sounding. Chord tones strummed at similar volume
//   survive; ghosts come in under.
const HARMONICS = [12, 19, 24, 28, 31, 34, 36, 38, 40]; // semitones above the fundamental, rounded
export function cleanPoly(notes: RawNote[], mono: boolean): RawNote[] {
  const amp = (n: RawNote) => n.amp ?? 1, end = (n: RawNote) => n.start + n.dur, keep: RawNote[] = [];
  for (const n of [...notes].sort((a, b) => amp(b) - amp(a))) {
    const p = Math.round(n.midiFloat);
    const clash = keep.some(k => {
      const iv = p - Math.round(k.midiFloat);
      if (mono) return Math.min(end(n), end(k)) - Math.max(n.start, k.start) > 0.5 * Math.min(n.dur, k.dur);
      return (
        (Math.abs(n.start - k.start) < 0.05 && [12, 19, 24].includes(iv) && amp(n) < 0.85 * amp(k)) ||
        (n.start >= k.start - 0.05 && n.start < end(k) && amp(n) < 0.6 * amp(k) && HARMONICS.includes(iv))
      );
    });
    if (!clash) keep.push(n);
  }
  keep.sort((a, b) => a.start - b.start);
  if (mono)
    for (let i = 0; i + 1 < keep.length; i++)
      if (end(keep[i]) > keep[i + 1].start) keep[i] = { ...keep[i], dur: keep[i + 1].start - keep[i].start };
  return keep;
}

export async function detectNotes(audio: AudioLike, S: DetectSettings, onProg?: (p: number) => void): Promise<RawNote[]> {
  const data = audio.getChannelData(0), sr = audio.sampleRate;
  if (S.engine === 'ai') {
    const { basicPitchNotes } = await import('./basicPitch');
    return cleanPoly(await basicPitchNotes(data, sr, onProg), S.instrument !== 'guitar');
  }

  const c = INSTR[S.instrument] || INSTR.whistle;
  const size = 2048, hop = 512, det = PitchDetector.forFloat32Array(size), hopSec = hop / sr;
  const frames: Array<{ t: number; e: number; midi: number | null }> = [];
  for (let i = 0; i + size <= data.length; i += hop) {
    const [hz, clarity] = det.findPitch(data.subarray(i, i + size), sr);
    let s = 0;
    const c0 = i + (size - hop) / 2; // short-window energy at the frame centre
    for (let j = c0; j < c0 + hop; j++) s += data[j] * data[j];
    frames.push({ t: i / sr, e: Math.sqrt(s / hop), midi: clarity >= S.clarity && hz > c.lo && hz < c.hi ? hzToMidiFloat(hz) : null });
  }
  // Re-articulation: energy jumps >2x over the last ~35ms (a breath gap, a re-pluck). Starts a
  // new note even at the same pitch, and such a note is never merged back, so "Hap-py" stays
  // two notes. A detector dropout keeps energy up.
  let peak = 1e-9;
  for (const f of frames) if (f.e > peak) peak = f.e; // no spread: long files exceed arg limits
  const attack = (k: number) =>
    k >= 3 && frames[k].e > 0.05 * peak && frames[k].e > 2 * Math.min(frames[k - 1].e, frames[k - 2].e, frames[k - 3].e);
  let lastAtk = -1e9; // ~70ms hold-off: a gradual onset fires on several frames; only its first counts
  // pitch from the note's stable middle: skips the attack scoop (whistlers slide up into notes) and the release droop
  const stable = (v: number[]) => (v.length >= 6 ? median(v.slice(Math.floor(v.length / 3), Math.ceil(v.length * 0.9))) : median(v));
  type Seg = { start: number; end: number; vals: number[]; med: number; atk: boolean };
  const notes: Array<RawNote & { atk: boolean }> = [];
  let cur: Seg | null = null; // runs within 0.6 semitone; break on silence, pitch jump or re-articulation
  const flush = () => {
    if (cur && (cur.end - cur.start) * 1000 >= S.minMs)
      notes.push({ midiFloat: stable(cur.vals), start: cur.start, dur: cur.end - cur.start, atk: cur.atk });
    cur = null;
  };
  frames.forEach((fr, k) => {
    if (fr.midi === null) {
      if (cur) flush();
      return;
    }
    const atk = k - lastAtk > 6 && attack(k);
    if (atk) lastAtk = k;
    if (cur && !atk && Math.abs(fr.midi - cur.med) < 0.6) {
      cur.vals.push(fr.midi);
      cur.end = fr.t + hopSec;
      cur.med = median(cur.vals);
    } else {
      if (cur) flush();
      cur = { start: fr.t, end: fr.t + hopSec, vals: [fr.midi], med: fr.midi, atk };
    }
  });
  flush();
  // merge same-pitch splits across a tiny gap (detector dropouts), not re-articulations
  const merged: Array<RawNote & { atk: boolean }> = [];
  for (const n of notes) {
    const p = merged[merged.length - 1];
    if (p && !n.atk && Math.round(p.midiFloat) === Math.round(n.midiFloat) && (n.start - (p.start + p.dur)) * 1000 <= S.mergeMs)
      p.dur = n.start + n.dur - p.start;
    else merged.push({ ...n });
  }
  return merged.map(({ atk: _atk, ...n }) => n);
}

// Latency calibration: onsets (recorded clicks, or taps) should land on beats; their shared
// phase vs the beat period is the system lag. Returns the offset in ms to compensate
// (negative = onsets arrive late, shift notes earlier), or null if there's no clear beat.
export function estimateLag(data: Float32Array, sr: number, beatSec: number): number | null {
  const win = Math.max(1, Math.round(sr * 0.01)), env: number[] = []; // 10ms RMS envelope
  for (let i = 0; i + win <= data.length; i += win) {
    let s = 0;
    for (let j = 0; j < win; j++) {
      const v = data[i + j];
      s += v * v;
    }
    env.push(Math.sqrt(s / win));
  }
  let max = 0;
  for (const e of env) if (e > max) max = e;
  if (!(max > 1e-4)) return null;
  const thr = max * 0.3, onsets: number[] = [];
  let last = -1;
  for (let k = 1; k < env.length; k++) {
    const t = (k * win) / sr; // rising edge over threshold + 80ms refractory
    if (env[k] > thr && env[k - 1] <= thr && (last < 0 || t - last > 0.08)) {
      onsets.push(t);
      last = t;
    }
  }
  if (onsets.length < 4) return null;
  let mx = 0, my = 0;
  for (const t of onsets) {
    const a = 2 * Math.PI * ((t % beatSec) / beatSec);
    mx += Math.cos(a);
    my += Math.sin(a);
  }
  mx /= onsets.length;
  my /= onsets.length;
  if (Math.hypot(mx, my) < 0.5) return null; // onsets not clustered to one phase -> no clear beat
  let phi = Math.atan2(my, mx);
  if (phi < 0) phi += 2 * Math.PI;
  let dev = (phi / (2 * Math.PI)) * beatSec; // [0, beatSec): seconds after the beat line
  if (dev > beatSec / 2) dev -= beatSec; // fold to the nearest grid line
  return Math.max(-300, Math.min(300, Math.round(-dev * 1000))); // clamped to the slider range
}
