import { CHROMATIC, type Note, type ClosestAlgorithm } from '../music/notes';
import type { RootNotesConfig, ExerciseKind } from '../exercise/rootNotes/types';

export type Route =
  | { screen: 'start' }
  | { screen: 'session'; config: RootNotesConfig };

export const START_HASH = '#/';

const VALID_NOTES = new Set<string>(CHROMATIC);
const VALID_ALGOS = new Set<string>(['fret-first', 'manhattan']);
const VALID_EXERCISES = new Set<string>(['root-notes', 'random-roots']);

function parseBool(v: string | null, fallback: boolean): boolean {
  if (v === null) return fallback;
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return fallback;
}

function parsePositiveInt(v: string | null): number | null {
  if (v === null) return null;
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function parseHash(hash: string): Route {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h.startsWith('/session')) return { screen: 'start' };

  const qIdx = h.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? h.slice(qIdx + 1) : '');

  const exRaw = params.get('ex') ?? 'root-notes';
  if (!VALID_EXERCISES.has(exRaw)) return { screen: 'start' };
  const exercise = exRaw as ExerciseKind;

  // 'random-roots' randomizes its target per prompt, so it has no fixed note to
  // validate. We still keep a harmless targetNote on the config (unused by the
  // random engine) — default to 'A' when absent/invalid.
  const note = params.get('note');
  let targetNote: Note;
  if (exercise === 'random-roots') {
    targetNote = note && VALID_NOTES.has(note) ? (note as Note) : 'A';
  } else {
    if (!note || !VALID_NOTES.has(note)) return { screen: 'start' };
    targetNote = note as Note;
  }

  const durationRaw = params.get('duration');
  let durationSec: number;
  let continuous: boolean;
  if (durationRaw === 'continuous') {
    continuous = true;
    // durationSec is unused while continuous, but the config requires a value.
    durationSec = 300;
  } else {
    const d = parsePositiveInt(durationRaw);
    if (d === null) return { screen: 'start' };
    durationSec = d;
    continuous = false;
  }

  const frets = parsePositiveInt(params.get('frets'));
  if (frets === null) return { screen: 'start' };

  const algoRaw = params.get('algo') ?? 'fret-first';
  if (!VALID_ALGOS.has(algoRaw)) return { screen: 'start' };

  const config: RootNotesConfig = {
    exercise,
    targetNote,
    durationSec,
    continuous,
    maxFret: frets,
    showAllLabels: parseBool(params.get('labels'), false),
    showRootMarkers: parseBool(params.get('roots'), false),
    showFretNumbers: parseBool(params.get('fretnums'), true),
    playSound: parseBool(params.get('sound'), true),
    algorithm: algoRaw as ClosestAlgorithm
  };
  return { screen: 'session', config };
}

export function sessionHash(config: RootNotesConfig): string {
  const params = new URLSearchParams();
  params.set('ex', config.exercise);
  params.set('note', config.targetNote);
  params.set('duration', config.continuous ? 'continuous' : String(config.durationSec));
  params.set('frets', String(config.maxFret));
  params.set('roots', config.showRootMarkers ? '1' : '0');
  params.set('labels', config.showAllLabels ? '1' : '0');
  params.set('fretnums', config.showFretNumbers ? '1' : '0');
  params.set('sound', config.playSound ? '1' : '0');
  params.set('algo', config.algorithm);
  return '#/session?' + params.toString();
}
