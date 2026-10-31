import { STANDARD_TUNING_MIDI, type StringNum } from '../music/tuning';
import { getAudioContext } from './context';

function frequencyFor(string: StringNum, fret: number): number {
  const midi = STANDARD_TUNING_MIDI[string] + fret;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Any pitch as a pluckable "position": the low E string (MIDI 40) with a
// possibly off-the-neck fret. Only the frequency matters to the synth.
export const midiAsPos = (midi: number): { string: StringNum; fret: number } => ({ string: 6, fret: midi - 40 });

export function playPluck(string: StringNum, fret: number, durationSec = 1.5): void {
  const audioCtx = getAudioContext();
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

// Plays two notes in sequence to sound out an interval: `first`, then `second`
// after a short gap. Used by the intervals exercise to let the player hear the
// 3rd/5th they just found.
export function playInterval(
  first: { string: StringNum; fret: number },
  second: { string: StringNum; fret: number },
  gapMs = 450
): void {
  playPluck(first.string, first.fret);
  setTimeout(() => playPluck(second.string, second.fret), gapMs);
}
