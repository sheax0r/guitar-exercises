// Live tuner readout: nearest note and cents offset for a detected pitch.
// Shared by Ideate's Recorder and Learn's mic exercises (via startPitchListener).
import { CHROMATIC } from '../music/notes';
import { hzToMidiFloat } from './pitchMath';

export interface TunerReading { note: string; cents: number }

export const IN_TUNE_CENTS = 15;

// null when the frame is unclear or outside [lo, hi] Hz (default: guitar range).
export function tunerReading(hz: number, clarity: number, lo = 75, hi = 1400, minClarity = 0.9): TunerReading | null {
  if (!(clarity > minClarity && hz > lo && hz < hi)) return null;
  const m = hzToMidiFloat(hz), r = Math.round(m);
  return { note: CHROMATIC[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1), cents: Math.round((m - r) * 100) };
}
