// Fixture manifest: everything we want to test. A fixture whose audio (or annotation) file is
// missing SKIPs with a reason; drop the file in (or run test/fetch_fixtures.py) and it runs.
//
//   song:   expected melody from songs.ts (pitch in semitones, timing in beats; tolerance 0.25 beat)
//   annot:  expected notes from a dataset annotation, scored mir_eval-style (absolute pitch + onset within 50 ms)
//   synth:  generate the audio (deterministic) instead of loading a file
//   file:   audio path relative to test/; without an extension, tries .wav .flac .webm .ogg .m4a .mp3
//   bpm:    the take's tempo if known (used to draw its tab); scoring fits tempo itself
//   expect: pass thresholds {f1, onset} per engine; null = just report numbers (INFO)
//
// Thresholds are regression floors set a little under measured results; raise them as detection improves.
import type { Engine, Instrument } from '../types';
import type { SynthOptions } from './synth';

export type Threshold = { f1: number; onset: number };
export interface Fixture {
  id: string;
  song?: 'happy-birthday';
  kind: string;
  instrument: Instrument;
  bpm: number | null;
  synth?: SynthOptions;
  file?: string;
  annot?: { file: string; format: 'vocadito-csv' | 'jams' };
  source: string;
  license: string;
  expect: Record<Engine, Threshold> | null;
}

const HB = 'happy-birthday' as const;

export const FIXTURES: Fixture[] = [
  // ---- golden synthetic takes: always available, exact timing ----
  { id: 'hb-whistle-synth', song: HB, kind: 'whistle', instrument: 'whistle', bpm: 100,
    synth: { timbre: 'whistle', bpm: 100, base: 79 },
    source: 'synthesized (sine + vibrato)', license: 'n/a',
    expect: { pitchy: { f1: 0.95, onset: 0.9 }, ai: { f1: 0.95, onset: 0.9 } } },
  { id: 'hb-whistle-synth-human', song: HB, kind: 'whistle', instrument: 'whistle', bpm: 100,
    synth: { timbre: 'whistle', bpm: 100, base: 79, humanize: 1, seed: 7 },
    source: 'synthesized, humanized (drift, jitter, breath)', license: 'n/a',
    // ai: Basic Pitch still merges the repeated "Hap-py" Gs across the short breath gap
    expect: { pitchy: { f1: 0.95, onset: 0.9 }, ai: { f1: 0.9, onset: 0.8 } } },
  { id: 'hb-hum-synth', song: HB, kind: 'hum', instrument: 'humming', bpm: 100,
    synth: { timbre: 'hum', bpm: 100, base: 55, humanize: 0.5, seed: 3 },
    source: 'synthesized (harmonic stack, low register)', license: 'n/a',
    expect: { pitchy: { f1: 0.95, onset: 0.9 }, ai: { f1: 0.95, onset: 0.9 } } },
  { id: 'hb-guitar-synth', song: HB, kind: 'guitar', instrument: 'guitar', bpm: 100,
    synth: { timbre: 'guitar', bpm: 100, base: 55 },
    source: 'synthesized (Karplus-Strong plucks, no gaps)', license: 'n/a',
    // pitchy: a same-pitch re-pluck of a still-ringing string barely raises energy, so 2 repeats merge
    expect: { pitchy: { f1: 0.9, onset: 0.8 }, ai: { f1: 0.95, onset: 0.9 } } },

  // ---- real recordings of Happy Birthday ----
  { id: 'hb-whistle-bigsoundbank', song: HB, kind: 'whistle', instrument: 'whistle', bpm: null,
    file: 'fixtures/hb-whistle-bigsoundbank.flac',
    source: 'BigSoundBank #2193 "Happy Birthday, Whistling" (Joseph Sardin)', license: 'CC0',
    // free tempo with rubato and held notes, so onsets vs a straight beat grid stay low
    expect: { pitchy: { f1: 0.8, onset: 0.4 }, ai: { f1: 0.7, onset: 0.4 } } },
  // your own takes, recorded in the app ("Save take")
  ...(['whistle', 'hum', 'sing', 'guitar'] as const).map(
    (k): Fixture => ({
      id: `hb-${k}-user`, song: HB, kind: k, bpm: 100,
      instrument: ({ whistle: 'whistle', hum: 'humming', sing: 'singing', guitar: 'guitar' } as const)[k],
      file: `fixtures/hb-${k}-user`,
      source: 'your recording (app, 100 BPM, 3/4)', license: 'yours', expect: null
    })
  ),

  // ---- annotated datasets (not Happy Birthday; same pitch AND onset within 50 ms) ----
  // Basic Pitch over-segments singing (extra notes), hence its low F1 here despite good onsets.
  ...Object.entries({
    10: { pitchy: { f1: 0.4, onset: 0.4 }, ai: { f1: 0.25, onset: 0.45 } },
    20: { pitchy: { f1: 0.7, onset: 0.75 }, ai: { f1: 0.6, onset: 0.9 } },
    14: { pitchy: { f1: 0.35, onset: 0.5 }, ai: { f1: 0.4, onset: 0.65 } }
  }).map(
    ([n, expect]): Fixture => ({
      id: `vocadito-${n}`, kind: 'sing', instrument: 'singing', bpm: null,
      file: `fixtures/vocadito/vocadito_${n}.wav`,
      annot: { file: `fixtures/vocadito/vocadito_${n}_notesA1.csv`, format: 'vocadito-csv' },
      source: `vocadito track ${n} (annotator A1)`, license: 'CC BY 4.0', expect
    })
  ),
  ...Object.entries({
    '00_Jazz1-200-B_solo': { pitchy: { f1: 0.55, onset: 0.45 }, ai: { f1: 0.8, onset: 0.85 } },
    '00_BN1-147-Gb_solo': { pitchy: { f1: 0.75, onset: 0.7 }, ai: { f1: 0.85, onset: 0.9 } }
  }).map(
    ([t, expect]): Fixture => ({
      id: `guitarset-${t.split('_')[1]}`, kind: 'guitar', instrument: 'guitar', bpm: +t.split('-')[1],
      file: `fixtures/guitarset/${t}_mic.wav`,
      annot: { file: `fixtures/guitarset/${t}.jams`, format: 'jams' },
      source: `GuitarSet ${t} (mono mic)`, license: 'CC BY 4.0', expect
    })
  )
];
