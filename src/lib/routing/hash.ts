import { CHROMATIC, type Note, type ClosestAlgorithm } from '../music/notes';
import { MODE_ORDER, type Mode } from '../music/modes';
import type { RootNotesConfig, ExerciseKind } from '../exercise/rootNotes/types';
import type { PlayShapeConfig, IdentifyModeConfig } from '../exercise/modes/types';
import type { AnyConfig } from '../exercise/config';

export type Route =
  | { screen: 'start' }
  | { screen: 'session'; config: AnyConfig };

export const START_HASH = '#/';

const VALID_NOTES = new Set<string>(CHROMATIC);
const VALID_ALGOS = new Set<string>(['fret-first', 'manhattan']);
const VALID_ROOT_EXERCISES = new Set<string>(['root-notes', 'random-roots']);
const VALID_MODES = new Set<string>(MODE_ORDER);

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

// duration=continuous → continuous mode; a positive integer → fixed duration.
// Returns null when the value is present but invalid.
function parseDuration(raw: string | null): { durationSec: number; continuous: boolean } | null {
  if (raw === 'continuous') return { durationSec: 300, continuous: true };
  const d = parsePositiveInt(raw);
  if (d === null) return null;
  return { durationSec: d, continuous: false };
}

function parseModes(raw: string | null): Mode[] | null {
  if (raw === null || raw === '') return null;
  const parts = raw.split(',').filter(p => p.length > 0);
  if (parts.length === 0) return null;
  for (const p of parts) {
    if (!VALID_MODES.has(p)) return null;
  }
  return parts as Mode[];
}

function parseRootNotes(params: URLSearchParams, exercise: ExerciseKind): Route {
  const note = params.get('note');
  let targetNote: Note;
  if (exercise === 'random-roots') {
    targetNote = note && VALID_NOTES.has(note) ? (note as Note) : 'A';
  } else {
    if (!note || !VALID_NOTES.has(note)) return { screen: 'start' };
    targetNote = note as Note;
  }

  const duration = parseDuration(params.get('duration'));
  if (duration === null) return { screen: 'start' };

  const frets = parsePositiveInt(params.get('frets'));
  if (frets === null) return { screen: 'start' };

  const algoRaw = params.get('algo') ?? 'fret-first';
  if (!VALID_ALGOS.has(algoRaw)) return { screen: 'start' };

  const config: RootNotesConfig = {
    exercise,
    targetNote,
    durationSec: duration.durationSec,
    continuous: duration.continuous,
    maxFret: frets,
    showAllLabels: parseBool(params.get('labels'), false),
    showRootMarkers: parseBool(params.get('roots'), false),
    showFretNumbers: parseBool(params.get('fretnums'), true),
    playSound: parseBool(params.get('sound'), true),
    algorithm: algoRaw as ClosestAlgorithm
  };
  return { screen: 'session', config };
}

function parsePlayShape(params: URLSearchParams): Route {
  const enabledModes = parseModes(params.get('modes'));
  if (enabledModes === null) return { screen: 'start' };

  const duration = parseDuration(params.get('duration'));
  if (duration === null) return { screen: 'start' };

  const frets = parsePositiveInt(params.get('frets'));
  if (frets === null) return { screen: 'start' };

  const variantRaw = params.get('variant') ?? 'octave';
  if (variantRaw !== 'octave' && variantRaw !== 'box') return { screen: 'start' };

  const judgeRaw = params.get('judge') ?? 'fixed';
  if (judgeRaw !== 'pitch' && judgeRaw !== 'fixed') return { screen: 'start' };

  const span = parsePositiveInt(params.get('span')) ?? 4;

  const config: PlayShapeConfig = {
    exercise: 'play-shape',
    enabledModes,
    shapeVariant: variantRaw,
    octaveJudge: judgeRaw,
    boxSpan: span,
    maxFret: frets,
    durationSec: duration.durationSec,
    continuous: duration.continuous,
    showFretNumbers: parseBool(params.get('fretnums'), true),
    playSound: parseBool(params.get('sound'), true)
  };
  return { screen: 'session', config };
}

function parseIdentifyMode(params: URLSearchParams): Route {
  const enabledModes = parseModes(params.get('modes'));
  if (enabledModes === null) return { screen: 'start' };

  const duration = parseDuration(params.get('duration'));
  if (duration === null) return { screen: 'start' };

  const frets = parsePositiveInt(params.get('frets'));
  if (frets === null) return { screen: 'start' };

  const config: IdentifyModeConfig = {
    exercise: 'identify-mode',
    enabledModes,
    maxFret: frets,
    durationSec: duration.durationSec,
    continuous: duration.continuous,
    showFretNumbers: parseBool(params.get('fretnums'), true),
    playSound: parseBool(params.get('sound'), true)
  };
  return { screen: 'session', config };
}

export function parseHash(hash: string): Route {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h.startsWith('/session')) return { screen: 'start' };

  const qIdx = h.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? h.slice(qIdx + 1) : '');

  const ex = params.get('ex') ?? 'root-notes';
  if (VALID_ROOT_EXERCISES.has(ex)) return parseRootNotes(params, ex as ExerciseKind);
  if (ex === 'play-shape') return parsePlayShape(params);
  if (ex === 'identify-mode') return parseIdentifyMode(params);
  return { screen: 'start' };
}

export function sessionHash(config: AnyConfig): string {
  const params = new URLSearchParams();
  params.set('ex', config.exercise);

  if (config.exercise === 'root-notes' || config.exercise === 'random-roots') {
    params.set('note', config.targetNote);
    params.set('duration', config.continuous ? 'continuous' : String(config.durationSec));
    params.set('frets', String(config.maxFret));
    params.set('roots', config.showRootMarkers ? '1' : '0');
    params.set('labels', config.showAllLabels ? '1' : '0');
    params.set('fretnums', config.showFretNumbers ? '1' : '0');
    params.set('sound', config.playSound ? '1' : '0');
    params.set('algo', config.algorithm);
  } else if (config.exercise === 'play-shape') {
    params.set('modes', config.enabledModes.join(','));
    params.set('variant', config.shapeVariant);
    params.set('judge', config.octaveJudge);
    params.set('span', String(config.boxSpan));
    params.set('duration', config.continuous ? 'continuous' : String(config.durationSec));
    params.set('frets', String(config.maxFret));
    params.set('fretnums', config.showFretNumbers ? '1' : '0');
    params.set('sound', config.playSound ? '1' : '0');
  } else if (config.exercise === 'identify-mode') {
    params.set('modes', config.enabledModes.join(','));
    params.set('duration', config.continuous ? 'continuous' : String(config.durationSec));
    params.set('frets', String(config.maxFret));
    params.set('fretnums', config.showFretNumbers ? '1' : '0');
    params.set('sound', config.playSound ? '1' : '0');
  }
  return '#/session?' + params.toString();
}
