import { getAudioContext } from './context';
import { CHROMATIC, type Note } from '../music/notes';

export interface DroneHandle {
  stop(): void;
}

// A root drone sits low under the plucks. Octave 3 keeps it below the
// fretboard's played range without muddying it. MIDI 48 = C3.
export function midiForDrone(note: Note): number {
  return CHROMATIC.indexOf(note) + 48;
}

function freqFor(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Starts a sustained triangle-wave drone at the given MIDI pitch. Returns a
// handle whose stop() ramps it out cleanly. No-op (safe handle) when there is
// no AudioContext (headless/unsupported).
export function startDrone(midi: number): DroneHandle {
  const ctx = getAudioContext();
  if (!ctx) return { stop() { /* no-op */ } };

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => { /* ignore */ });
  }

  try {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freqFor(midi);
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
    osc.connect(gain).connect(ctx.destination);
    osc.start();

    let stopped = false;
    return {
      stop() {
        if (stopped) return;
        stopped = true;
        try {
          const t = ctx.currentTime;
          gain.gain.cancelScheduledValues(t);
          gain.gain.setValueAtTime(gain.gain.value, t);
          gain.gain.linearRampToValueAtTime(0, t + 0.04);
          osc.stop(t + 0.05);
        } catch {
          /* ignore */
        }
      }
    };
  } catch {
    return { stop() { /* no-op */ } };
  }
}
