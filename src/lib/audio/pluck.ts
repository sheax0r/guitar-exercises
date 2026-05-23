import type { StringNum } from '../music/tuning';

// MIDI numbers for the open strings (string 1 = high E = E4 = MIDI 64).
const OPEN_MIDI: Record<StringNum, number> = {
  1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40
};

let ctx: AudioContext | null = null;
let ctxFailed = false;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (ctxFailed) return null;
  if (typeof window === 'undefined') {
    ctxFailed = true;
    return null;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    ctxFailed = true;
    return null;
  }
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    ctxFailed = true;
    return null;
  }
}

function frequencyFor(string: StringNum, fret: number): number {
  const midi = OPEN_MIDI[string] + fret;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playPluck(string: StringNum, fret: number, durationSec = 1.5): void {
  const audioCtx = getCtx();
  if (!audioCtx) return;

  // Browsers create AudioContexts in 'suspended' state on production origins
  // per the autoplay policy. Resume here — this call is reached from a click
  // handler, so the user-gesture requirement is satisfied. On localhost the
  // context often starts already 'running', so this was easy to miss.
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => { /* ignore */ });
  }

  try {
    const freq = frequencyFor(string, fret);
    const sampleRate = audioCtx.sampleRate;
    const delayLen = Math.max(2, Math.round(sampleRate / freq));
    const numSamples = Math.round(sampleRate * durationSec);
    const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    // Initialize the delay line with white noise (pluck excitation).
    const line = new Float32Array(delayLen);
    for (let i = 0; i < delayLen; i++) {
      line[i] = Math.random() * 2 - 1;
    }

    // Karplus-Strong loop: output current sample, replace with average of
    // current + next, scaled by a decay factor.
    const decay = 0.996;
    let idx = 0;
    for (let i = 0; i < numSamples; i++) {
      const current = line[idx];
      const next = line[(idx + 1) % delayLen];
      data[i] = current;
      line[idx] = (current + next) * 0.5 * decay;
      idx = (idx + 1) % delayLen;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    source.connect(gain).connect(audioCtx.destination);
    source.start();
  } catch {
    // Any audio playback failure: silently skip.
  }
}
