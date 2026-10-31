import { PitchDetector } from 'pitchy';
import { getAudioContext } from './context';
import { tunerReading, type TunerReading } from './tuner';
import { hzToMidi, rms, inGuitarRange, rmsFloorForSensitivity, DEFAULT_MIC_SENSITIVITY, OnsetDetector, type OnsetOptions } from './pitchMath';

export interface PitchListener {
  stop(): void;
  // Adjust the loudness floor live (0 = chill, 1 = sensitive). No restart.
  setSensitivity(sensitivity: number): void;
}

export interface PitchListenerOptions extends OnsetOptions {
  sensitivity?: number;   // 0..1, maps to the RMS loudness floor
  deviceId?: string | null; // specific audio input, or null/undefined for default
  onTuner?: (reading: TunerReading | null) => void; // every frame, for a live tuner
}

// Lists the available audio input devices (best-effort; labels are only
// populated once mic permission has been granted). Returns [] if unsupported.
export async function listAudioInputs(): Promise<Array<{ deviceId: string; label: string }>> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav?.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await nav.mediaDevices.enumerateDevices();
    return devices
      .filter(d => d.kind === 'audioinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
  } catch {
    return [];
  }
}

// Opens an audio input (a specific device, or the default). A stale/unplugged
// device id must not kill the mic: it falls back to the default input. If that
// also fails (no mic / denied), the error surfaces.
// `extra` adds track constraints (echo cancellation, AGC...).
export async function openMic(deviceId?: string | null, extra?: MediaTrackConstraints): Promise<MediaStream> {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!md?.getUserMedia) throw new Error('microphone unavailable');
  try {
    return await md.getUserMedia({ audio: deviceId ? { ...extra, deviceId: { exact: deviceId } } : extra ?? true });
  } catch (e) {
    if (deviceId) return md.getUserMedia({ audio: extra ?? true });
    throw e;
  }
}

// The per-frame mic judging every Learn mic exercise uses: loudness gate,
// pitchy, guitar range, then the onset detector. Pure (no Web Audio), so the
// fixture harness can replay recordings through exactly this path.
export function createFrameJudge(sampleRate: number, size: number, opts: PitchListenerOptions = {}) {
  const detector = PitchDetector.forFloat32Array(size);
  const onset = new OnsetDetector(opts);
  let minRms = rmsFloorForSensitivity(opts.sensitivity ?? DEFAULT_MIC_SENSITIVITY);
  return {
    setSensitivity(s: number) { minRms = rmsFloorForSensitivity(s); },
    // One analyser frame -> the accepted note onset (or null) and a tuner reading.
    push(input: Float32Array): { note: number | null; tuner: TunerReading | null } {
      // Loudness gate first: below the floor, report silence (also lets the onset
      // detector register the gap so the next real note is a fresh onset).
      if (rms(input) < minRms) {
        onset.push(null, 0);
        return { note: null, tuner: null };
      }
      const [hz, clarity] = detector.findPitch(input, sampleRate);
      let midi: number | null = null;
      if (clarity > 0 && hz > 0 && Number.isFinite(hz)) {
        const m = hzToMidi(hz);
        if (inGuitarRange(m)) midi = m;
      }
      return { note: onset.push(midi, clarity), tuner: tunerReading(hz, clarity) };
    }
  };
}

// Replays a recording through the live judging path, one 2048-sample frame per
// animation frame (fps), as the mic sees it. Returns accepted onsets in seconds.
export function listenOffline(data: Float32Array, sampleRate: number, opts: PitchListenerOptions = {}, fps = 60): Array<{ midi: number; t: number }> {
  const size = 2048, hop = Math.round(sampleRate / fps), judge = createFrameJudge(sampleRate, size, opts);
  const out: Array<{ midi: number; t: number }> = [];
  for (let i = 0; i + size <= data.length; i += hop) {
    const { note } = judge.push(data.subarray(i, i + size));
    if (note !== null) out.push({ midi: note, t: (i + size) / sampleRate });
  }
  return out;
}

// Opens the microphone and streams detected note onsets to `onNote` (one call
// per note played). Rejects when the mic is unavailable or denied, so callers
// can fall back to another input. The returned handle stops detection and
// releases the mic, and can retune sensitivity live.
export async function startPitchListener(
  onNote: (midi: number) => void,
  opts: PitchListenerOptions = {}
): Promise<PitchListener> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav?.mediaDevices?.getUserMedia) {
    throw new Error('microphone unavailable');
  }
  const ctx = getAudioContext();
  if (!ctx) throw new Error('audio context unavailable');
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }

  const stream = await openMic(opts.deviceId);
  let source: MediaStreamAudioSourceNode;
  let analyser: AnalyserNode;
  try {
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
  } catch (e) {
    // Release the mic if wiring the graph fails after getUserMedia resolved.
    stream.getTracks().forEach(t => t.stop());
    throw e;
  }

  const input = new Float32Array(analyser.fftSize);
  const judge = createFrameJudge(ctx.sampleRate, analyser.fftSize, opts);

  let raf = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(input);
    const { note, tuner } = judge.push(input);
    opts.onTuner?.(tuner);
    if (note !== null) {
      try { onNote(note); } catch { /* listener errors never break the loop */ }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      try { source.disconnect(); } catch { /* ignore */ }
      try { stream.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
    },
    setSensitivity(sensitivity: number) {
      judge.setSensitivity(sensitivity);
    }
  };
}
