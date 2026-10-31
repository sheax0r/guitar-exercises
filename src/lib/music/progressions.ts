import type { ChordType } from './caged';

export type ProgressionId = 'I-IV-V' | 'ii-V-I' | 'blues' | 'I-vi-IV-V';
export const PROGRESSION_ORDER: ProgressionId[] = ['I-IV-V', 'ii-V-I', 'blues', 'I-vi-IV-V'];
export const PROGRESSION_DISPLAY: Record<ProgressionId, string> = {
  'I-IV-V': 'I–IV–V', 'ii-V-I': 'ii–V–I', blues: '12-bar blues', 'I-vi-IV-V': 'I–vi–IV–V'
};

// Diatonic 7th chords of a major key, plus the blues' dominant 7ths.
const NUMERALS: Record<string, { semis: number; type: ChordType }> = {
  I: { semis: 0, type: 'maj7' }, ii: { semis: 2, type: 'm7' }, IV: { semis: 5, type: 'maj7' },
  V: { semis: 7, type: '7' }, vi: { semis: 9, type: 'm7' },
  I7: { semis: 0, type: '7' }, IV7: { semis: 5, type: '7' }, V7: { semis: 7, type: '7' }
};

// One numeral per bar.
const BARS: Record<ProgressionId, string[]> = {
  'I-IV-V': ['I', 'IV', 'V'],
  'ii-V-I': ['ii', 'V', 'I'],
  blues: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
  'I-vi-IV-V': ['I', 'vi', 'IV', 'V']
};

export interface ProgressionChord { numeral: string; semis: number; type: ChordType; bars: number }

// The chord changes, with consecutive repeats merged into one multi-bar chord.
export function progressionChords(id: ProgressionId): ProgressionChord[] {
  const out: ProgressionChord[] = [];
  for (const numeral of BARS[id]) {
    const last = out[out.length - 1];
    if (last?.numeral === numeral) last.bars += 1;
    else out.push({ numeral, ...NUMERALS[numeral], bars: 1 });
  }
  return out;
}
