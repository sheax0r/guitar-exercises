// Spotify Basic Pitch: polyphonic neural transcription (TF.js). Loaded lazily from the CDN
// (~1 MB model on first use) so it never reaches any bundle.
import type { RawNote } from './types';

export const BP_BASE = 'https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1';
// CDN module with no local types.
let bpMod: any = null;
let bp: any = null; // one model instance, reused across calls

// Linear-interpolation resample. Also used before source separation (44.1 kHz).
export function resampleTo(data: Float32Array, sr: number, target: number): Float32Array {
  if (sr === target) return data;
  const ratio = target / sr, n = Math.floor(data.length * ratio), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i / ratio, idx = Math.floor(pos), frac = pos - idx;
    const a = data[idx] || 0, b = data[idx + 1] !== undefined ? data[idx + 1] : a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export async function basicPitchNotes(data: Float32Array, sr: number, onProg?: (p: number) => void): Promise<RawNote[]> {
  bpMod = bpMod || (await import(/* @vite-ignore */ `${BP_BASE}/+esm`));
  bp = bp || new bpMod.BasicPitch(`${BP_BASE}/model/model.json`);
  const audio = resampleTo(data, sr, 22050);
  const frames: number[][] = [], onsets: number[][] = [], contours: number[][] = [];
  await bp.evaluateModel(
    audio,
    (f: number[][], o: number[][], c: number[][]) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p: number) => onProg?.(p)
  );
  // onset threshold, frame threshold, min frames
  const notes = bpMod.noteFramesToTime(
    bpMod.addPitchBendsToNoteEvents(contours, bpMod.outputToNotesPoly(frames, onsets, 0.5, 0.3, 5))
  );
  return notes.map((n: { pitchMidi: number; startTimeSeconds: number; durationSeconds: number; amplitude: number }) => ({
    midiFloat: n.pitchMidi,
    start: n.startTimeSeconds,
    dur: n.durationSeconds,
    amp: n.amplitude
  }));
}
