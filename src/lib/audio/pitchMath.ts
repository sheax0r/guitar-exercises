// Pure pitch-detection helpers, isolated from Web Audio so they are unit
// testable (jsdom has no real AudioContext or microphone).

// Nearest MIDI note number for a frequency in Hz (A4 = 440 Hz = MIDI 69).
export function hzToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

// Sensitivity (0 = chill, 1 = picks up quiet playing) maps to an RMS loudness
// floor. Higher sensitivity = lower floor. Default sits mid-range. The right
// value is rig-dependent (pickup output, interface gain), hence the slider.
export const DEFAULT_MIC_SENSITIVITY = 0.5;
export function rmsFloorForSensitivity(sensitivity: number): number {
  const s = Math.max(0, Math.min(1, sensitivity));
  const MAX_FLOOR = 0.04; // chill: only loud notes pass
  const MIN_FLOOR = 0.004; // sensitive: quiet notes pass
  return MAX_FLOOR - s * (MAX_FLOOR - MIN_FLOOR);
}

// Root-mean-square level of a time-domain frame (0..~1). Used as a loudness
// gate so idle line hum / hiss below a floor is treated as silence.
export function rms(buf: ArrayLike<number>): number {
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
  return buf.length > 0 ? Math.sqrt(sumSq / buf.length) : 0;
}

// Plausible guitar range: low E (E1≈MIDI 28, drop tunings) up past the 24th
// fret on the high E. Readings outside this are spurious (sub-harmonics, noise).
export const MIN_GUITAR_MIDI = 28;
export const MAX_GUITAR_MIDI = 88;
export function inGuitarRange(midi: number): boolean {
  return midi >= MIN_GUITAR_MIDI && midi <= MAX_GUITAR_MIDI;
}

export interface OnsetOptions {
  clarityThreshold?: number; // minimum pitchy "clarity" to trust a reading
  stableFrames?: number;     // consecutive equal readings before accepting
}

// Turns a noisy per-frame stream of (midi, clarity) readings into discrete note
// onsets. A single held or ringing note is accepted once; the same note is only
// re-accepted after a silence gap (clarity dropped below threshold). This stops
// one sustained guitar note from firing many submissions.
export class OnsetDetector {
  private readonly clarityThreshold: number;
  private readonly stableFrames: number;
  private lastAccepted: number | null = null;
  private candidate: number | null = null;
  private candidateCount = 0;
  private sawSilence = true; // allow the very first note through

  constructor(opts: OnsetOptions = {}) {
    this.clarityThreshold = opts.clarityThreshold ?? 0.93;
    this.stableFrames = opts.stableFrames ?? 5;
  }

  // Feed one frame. Returns the accepted MIDI note on an onset, else null.
  push(midi: number | null, clarity: number): number | null {
    if (midi === null || clarity < this.clarityThreshold) {
      this.sawSilence = true;
      this.candidate = null;
      this.candidateCount = 0;
      return null;
    }

    if (midi === this.candidate) {
      this.candidateCount += 1;
    } else {
      this.candidate = midi;
      this.candidateCount = 1;
    }

    const stable = this.candidateCount >= this.stableFrames;
    const isNewOnset = midi !== this.lastAccepted || this.sawSilence;
    if (stable && isNewOnset) {
      this.lastAccepted = midi;
      this.sawSilence = false;
      return midi;
    }
    return null;
  }
}
