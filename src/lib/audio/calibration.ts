// Latency calibration: play N metronome beats, record them (or the player's taps), and
// measure how far the onsets sit off the beat grid. The result is a timing offset in ms
// (negative = shift notes earlier), saved as the default for new recordings.
import { beatSeconds, scheduleClick } from './metronome';

// Whistler's key, kept as-is so existing users keep their calibration.
export const CALIB_KEY = 'whistler.calib';

export function loadCalibMs(): number {
  try {
    return Math.round(Number(localStorage.getItem(CALIB_KEY))) || 0;
  } catch {
    return 0;
  }
}

export function hasCalib(): boolean {
  try {
    return localStorage.getItem(CALIB_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveCalibMs(ms: number): void {
  try {
    localStorage.setItem(CALIB_KEY, String(ms));
  } catch {
    /* private mode: keep it for this session only */
  }
}

export interface CalibrateOptions {
  bpm: number;
  num: number;
  den: number;
  beats?: number;
  volume: number;
  onBeat?: (beat: number, delayMs: number) => void; // UI flash
}

// Records `stream` while clicking `beats` beats; resolves with the offset in ms, or null
// when no clear beat was heard. The caller owns (and stops) the stream.
export async function calibrate(ctx: AudioContext, stream: MediaStream, o: CalibrateOptions): Promise<number | null> {
  const beats = o.beats ?? 8, beatSec = beatSeconds(o.bpm, o.den), num = o.num || 4;
  const rec = new MediaRecorder(stream), chunks: Blob[] = [];
  rec.ondataavailable = e => chunks.push(e.data);
  const done = new Promise<Blob>(res => {
    rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
  });
  rec.start();
  const t0 = ctx.currentTime + 0.25;
  for (let k = 0; k < beats; k++) {
    scheduleClick(ctx, t0 + k * beatSec, k % num === 0, o.volume); // tapper follows it; clicks mode records it
    o.onBeat?.(k, Math.max(0, (t0 + k * beatSec - ctx.currentTime) * 1000));
  }
  setTimeout(() => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  }, (t0 + beats * beatSec - ctx.currentTime) * 1000 + 300);
  const buf = await ctx.decodeAudioData(await (await done).arrayBuffer());
  // Lazy: detect.ts is heavy and only Ideate calibrates; Learn just reads the offset.
  const { estimateLag } = await import('../transcribe/detect');
  return estimateLag(buf.getChannelData(0), buf.sampleRate, beatSec);
}
