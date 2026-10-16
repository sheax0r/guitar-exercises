import { PitchDetector } from 'pitchy';
import { getAudioContext } from './context';
import { hzToMidi, OnsetDetector, type OnsetOptions } from './pitchMath';

export interface PitchListener {
  stop(): void;
}

// Opens the microphone and streams detected note onsets to `onNote` (one call
// per note played). Rejects when the mic is unavailable or denied, so callers
// can fall back to another input. The returned handle stops detection and
// releases the mic.
export async function startPitchListener(
  onNote: (midi: number) => void,
  opts: OnsetOptions = {}
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

  const stream = await nav.mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  const input = new Float32Array(analyser.fftSize);
  const onset = new OnsetDetector(opts);

  let raf = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(input);
    const [hz, clarity] = detector.findPitch(input, ctx.sampleRate);
    const midi = clarity > 0 && hz > 0 && Number.isFinite(hz) ? hzToMidi(hz) : null;
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
    }
  };
}
