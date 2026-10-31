import { NOTE_DISPLAY } from '../music/notes';
import { MODE_DISPLAY, MODE_ORDER, type Mode } from '../music/modes';
import type { AnyConfig } from './config';
import { CAGED_ORDER } from '../music/caged';

const CAGED_VARIANT_LABEL = { 'find-tones': 'Find tones', 'name-shape': 'Name the shape', 'next-shape': 'Next shape' };

// One-line human description of a config, e.g.
// "Root Notes · A · 5m · 12 frets".
export function summarize(c: AnyConfig): string {
  const parts: string[] = [];
  switch (c.exercise) {
    case 'root-notes':
      parts.push('Root Notes', NOTE_DISPLAY[c.targetNote]);
      break;
    case 'random-roots':
      parts.push('Root Notes', 'A/E/D');
      break;
    case 'intervals': {
      const root = c.keyRoot === 'random' ? 'any key' : NOTE_DISPLAY[c.keyRoot];
      const quality = c.keyQuality === 'random' ? 'major/minor' : c.keyQuality;
      parts.push('Intervals', c.intervalKind === 'random' ? '3rd/5th' : c.intervalKind, `${root} ${quality}`);
      break;
    }
    case 'play-shape':
      parts.push('Play the Shape', modes(c.enabledModes));
      parts.push(c.shapeVariant === 'octave' ? 'Octave' : `Box (${c.boxSpan} frets)`);
      if (c.inputMode === 'mic') parts.push('Mic');
      break;
    case 'identify-mode':
      parts.push('Identify the Mode', modes(c.enabledModes));
      if (c.promptMode === 'audio') parts.push('By ear');
      break;
    case 'caged': {
      const shapes = CAGED_ORDER.filter(s => c.enabledShapes.includes(s)).join('');
      const quals = c.qualities.length === 2 ? 'major/minor' : c.qualities[0];
      parts.push('CAGED', CAGED_VARIANT_LABEL[c.cagedVariant], shapes, `${quals}${c.include7th ? ' 7ths' : ''}`);
      if (c.fixedRootNote) parts.push(`in ${NOTE_DISPLAY[c.fixedRootNote]}`);
      if (c.inputMode === 'mic') parts.push('Mic');
      break;
    }
  }
  const d = c.durationSec;
  parts.push(c.continuous ? 'Continuous' : d % 60 === 0 ? `${d / 60}m` : `${d}s`);
  parts.push(`${c.maxFret} frets`);
  return parts.join(' · ');
}

function modes(enabled: Mode[]): string {
  if (enabled.length >= MODE_ORDER.length) return 'All modes';
  if (enabled.length > 3) return `${enabled.length} modes`;
  return MODE_ORDER.filter((m) => enabled.includes(m)).map((m) => MODE_DISPLAY[m]).join(', ');
}
