// Pure pitch-detection helpers, isolated from Web Audio so they are unit
// testable (jsdom has no real AudioContext or microphone).

// Nearest MIDI note number for a frequency in Hz (A4 = 440 Hz = MIDI 69).
export function hzToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
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
    this.clarityThreshold = opts.clarityThreshold ?? 0.9;
    this.stableFrames = opts.stableFrames ?? 3;
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
