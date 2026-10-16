import { PitchDetector } from 'pitchy';
import { getAudioContext } from './context';
import { hzToMidi, rms, inGuitarRange, rmsFloorForSensitivity, DEFAULT_MIC_SENSITIVITY, OnsetDetector, type OnsetOptions } from './pitchMath';

export interface PitchListener {
  stop(): void;
  // Adjust the loudness floor live (0 = chill, 1 = sensitive). No restart.
  setSensitivity(sensitivity: number): void;
}

export interface PitchListenerOptions extends OnsetOptions {
  sensitivity?: number;   // 0..1, maps to the RMS loudness floor
  deviceId?: string | null; // specific audio input, or null/undefined for default
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

  let stream: MediaStream;
  try {
    stream = await nav.mediaDevices.getUserMedia({
      audio: opts.deviceId ? { deviceId: { exact: opts.deviceId } } : true
    });
  } catch (e) {
    // A stale/unplugged device id must not kill the mic: fall back to the
    // default input. If that also fails (no mic / denied), surface the error.
    if (opts.deviceId) {
      stream = await nav.mediaDevices.getUserMedia({ audio: true });
    } else {
      throw e;
    }
  }
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

  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  const input = new Float32Array(analyser.fftSize);
  const onset = new OnsetDetector(opts);
  let minRms = rmsFloorForSensitivity(opts.sensitivity ?? DEFAULT_MIC_SENSITIVITY);

  let raf = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(input);
    // Loudness gate first: below the floor, report silence (also lets the onset
    // detector register the gap so the next real note is a fresh onset).
    if (rms(input) < minRms) {
      onset.push(null, 0);
      raf = requestAnimationFrame(tick);
      return;
    }
    const [hz, clarity] = detector.findPitch(input, ctx.sampleRate);
    let midi: number | null = null;
    if (clarity > 0 && hz > 0 && Number.isFinite(hz)) {
      const m = hzToMidi(hz);
      if (inGuitarRange(m)) midi = m;
    }
    const accepted = onset.push(midi, clarity);
    if (accepted !== null) {
      try { onNote(accepted); } catch { /* listener errors never break the loop */ }
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
      minRms = rmsFloorForSensitivity(sensitivity);
    }
  };
}
