import { playPluck } from './pluck';
import type { StringNum } from '../music/tuning';

// Plays a list of positions one after another, `gapMs` apart, by scheduling a
// pluck per note. Fire-and-forget like playPluck. Empty list is a no-op.
export function playSequence(
  notes: Array<{ string: StringNum; fret: number }>,
  gapMs = 350
): void {
  notes.forEach((n, i) => {
    if (i === 0) {
      playPluck(n.string, n.fret);
    } else {
      setTimeout(() => playPluck(n.string, n.fret), i * gapMs);
    }
  });
}
