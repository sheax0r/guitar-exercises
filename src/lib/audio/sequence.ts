import { playPluck } from './pluck';
import type { StringNum } from '../music/tuning';

// Plays a list of positions one after another, `gapMs` apart, by scheduling a
// pluck per note. Returns a canceller that clears any not-yet-played notes, so
// a new prompt or a repeated Replay doesn't overlap scales. Empty list is a
// no-op whose canceller is safe to call.
export function playSequence(
  notes: Array<{ string: StringNum; fret: number }>,
  gapMs = 350
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  notes.forEach((n, i) => {
    if (i === 0) {
      playPluck(n.string, n.fret);
    } else {
      timers.push(setTimeout(() => playPluck(n.string, n.fret), i * gapMs));
    }
  });
  return () => {
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
  };
}
