import { NOTE_DISPLAY } from '../music/notes';
import { MODE_DISPLAY, MODE_ORDER, SCALE_ORDER, type ScaleType } from '../music/modes';
import type { AnyConfig } from './config';
import { CAGED_ORDER } from '../music/caged';
import { PROGRESSION_DISPLAY } from '../music/progressions';

const TONE_LABEL = { any: 'Any chord tone', '3rd': '3rds', '7th': '7ths', guide: 'Guide tones' };
const CAGED_VARIANT_LABEL = { 'find-tones': 'Find tones', 'name-shape': 'Name the shape', 'next-shape': 'Next shape' };

// One-line human description of a config, e.g.
// "Root Notes · A · 5m · 12 frets".
export function summarize(c: AnyConfig): string {
  const parts: string[] = [];
  switch (c.exercise) {
    case 'root-notes':
      parts.push('Root Notes', NOTE_DISPLAY[c.targetNote], ...findAll(c));
      break;
    case 'random-roots':
      parts.push('Root Notes', 'A/E/D', ...findAll(c));
      break;
    case 'intervals': {
      const root = c.keyRoot === 'random' ? 'any key' : NOTE_DISPLAY[c.keyRoot];
      const quality = c.keyQuality === 'random' ? 'major/minor' : c.keyQuality;
      const ints = c.intervals.join('/');
      if (c.intervalRef === 'from-root') parts.push('Intervals', `${ints} from the root`, root);
      else parts.push('Intervals', ints, `${root} ${quality}`);
      break;
    }
    case 'play-shape':
      parts.push('Play the Shape', modes(c.enabledModes));
      parts.push(c.shapeVariant === 'octave' ? 'Octave' : c.shapeVariant === 'caged' ? 'CAGED' : `Box (${c.boxSpan} frets)`);
      if (c.inputMode === 'mic') parts.push('Mic');
      break;
    case 'identify-mode':
      parts.push('Identify the Mode', modes(c.enabledModes));
      if (c.promptMode === 'audio') parts.push('By ear');
      break;
    case 'degrees':
      parts.push('Name the Degree', c.degreeVariant === 'name' ? 'Name it' : 'Find it',
        c.keyRoot === 'random' ? 'any key' : `key of ${NOTE_DISPLAY[c.keyRoot]}`);
      break;
    case 'chord-tones':
      parts.push('Chord Tones', PROGRESSION_DISPLAY[c.progression], TONE_LABEL[c.target],
        c.keyRoot === 'random' ? 'any key' : `key of ${NOTE_DISPLAY[c.keyRoot]}`);
      if (c.tempo === 'timed') parts.push(`${c.bpm} bpm`);
      if (c.inputMode === 'mic') parts.push('Mic');
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

function findAll(c: { rootVariant?: string; findAllWindow?: string }): string[] {
  if (c.rootVariant !== 'find-all') return [];
  return [c.findAllWindow === 'window' ? 'Find all (5-fret window)' : 'Find all'];
}

function modes(enabled: ScaleType[]): string {
  const onlyModes = enabled.every(m => (MODE_ORDER as ScaleType[]).includes(m));
  if (enabled.length >= SCALE_ORDER.length) return 'All scales';
  if (onlyModes && enabled.length >= MODE_ORDER.length) return 'All modes';
  if (enabled.length > 3) return `${enabled.length} ${onlyModes ? 'modes' : 'scales'}`;
  return SCALE_ORDER.filter((m) => enabled.includes(m)).map((m) => MODE_DISPLAY[m]).join(', ');
}
