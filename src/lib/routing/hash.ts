import { CHROMATIC, type Note, type ClosestAlgorithm } from '../music/notes';
import { SCALE_ORDER, type ScaleType } from '../music/modes';
import { DEFAULT_MIC_SENSITIVITY } from '../audio/pitchMath';
import type { ExerciseConfig, ExerciseKind } from '../exercise/types';
import type { PlayShapeConfig, IdentifyModeConfig } from '../exercise/modes/types';
import type { AnyConfig } from '../exercise/config';
import type { CagedConfig } from '../exercise/caged/types';
import { CAGED_ORDER } from '../music/caged';

export type Route =
  | { screen: 'home' }
  | { screen: 'learn' }
  | { screen: 'ideate' }
  | { screen: 'session'; config: AnyConfig };

export const HOME_HASH = '#/';
export const LEARN_HASH = '#/learn';
export const IDEATE_HASH = '#/ideate';
const SESSION_PREFIX = '#/learn/session?';

const VALID_NOTES = new Set<string>(CHROMATIC);
const VALID_ALGOS = new Set<string>(['fret-first', 'manhattan']);
const VALID_FRETBOARD_EXERCISES = new Set<string>(['root-notes', 'random-roots', 'intervals']);
const VALID_INTERVALS = new Set<string>(['3rd', '5th', 'random']);
const VALID_QUALITIES = new Set<string>(['major', 'minor', 'random']);
const VALID_DIRECTIONS = new Set<string>(['nearest', 'ascending']);
const VALID_MODES = new Set<string>(SCALE_ORDER);

// Reads a param against an allowed set, falling back to `fallback` when absent
// or invalid. Intervals-only params use this so legacy URLs (without them) and
// non-intervals exercises still parse.
function parseEnum<T extends string>(v: string | null, valid: Set<string>, fallback: T): T {
  return v !== null && valid.has(v) ? (v as T) : fallback;
}

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

function parseModes(raw: string | null): ScaleType[] | null {
  if (raw === null || raw === '') return null;
  const parts = raw.split(',').filter(p => p.length > 0);
  if (parts.length === 0) return null;
  for (const p of parts) {
    if (!VALID_MODES.has(p)) return null;
  }
  return parts as ScaleType[];
}

// 'random' or absent/invalid → null (random root); a valid note → fixed root.
function parseFixedRoot(raw: string | null): Note | null {
  return raw && raw !== 'random' && VALID_NOTES.has(raw) ? (raw as Note) : null;
}

// An integer percentage 0..100; absent/invalid falls back to `fallback`.
function parsePercentage(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : fallback;
}

// A 0..1 float; absent/blank/invalid falls back to the default. (Blank guarded
// because Number('') === 0 would otherwise read as full-chill sensitivity.)
function parseUnit(raw: string | null, fallback: number): number {
  if (raw === null || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

function parseFretboard(params: URLSearchParams, exercise: ExerciseKind): Route {
  const note = params.get('note');
  let targetNote: Note;
  if (exercise === 'random-roots' || exercise === 'intervals') {
    targetNote = note && VALID_NOTES.has(note) ? (note as Note) : 'A';
  } else {
    if (!note || !VALID_NOTES.has(note)) return { screen: 'learn' };
    targetNote = note as Note;
  }

  const duration = parseDuration(params.get('duration'));
  if (duration === null) return { screen: 'learn' };

  const frets = parsePositiveInt(params.get('frets'));
  if (frets === null) return { screen: 'learn' };

  const algoRaw = params.get('algo') ?? 'fret-first';
  if (!VALID_ALGOS.has(algoRaw)) return { screen: 'learn' };

  const keyRootRaw = params.get('keyroot');
  const keyRoot: Note | 'random' =
    keyRootRaw === 'random' ? 'random'
    : keyRootRaw && VALID_NOTES.has(keyRootRaw) ? (keyRootRaw as Note)
    : 'C';

  const config: ExerciseConfig = {
    exercise,
    targetNote,
    durationSec: duration.durationSec,
    continuous: duration.continuous,
    maxFret: frets,
    showAllLabels: parseBool(params.get('labels'), false),
    showRootMarkers: parseBool(params.get('roots'), false),
    showFretNumbers: parseBool(params.get('fretnums'), true),
    playSound: parseBool(params.get('sound'), true),
    algorithm: algoRaw as ClosestAlgorithm,
    intervalKind: parseEnum(params.get('int'), VALID_INTERVALS, 'random'),
    keyRoot,
    keyQuality: parseEnum(params.get('keyqual'), VALID_QUALITIES, 'major'),
    direction: parseEnum(params.get('dir'), VALID_DIRECTIONS, 'nearest')
  };
  return { screen: 'session', config };
}

function parsePlayShape(params: URLSearchParams): Route {
  const enabledModes = parseModes(params.get('modes'));
  if (enabledModes === null) return { screen: 'learn' };

  const duration = parseDuration(params.get('duration'));
  if (duration === null) return { screen: 'learn' };

  const frets = parsePositiveInt(params.get('frets'));
  if (frets === null) return { screen: 'learn' };

  const variantRaw = params.get('variant') ?? 'octave';
  if (variantRaw !== 'octave' && variantRaw !== 'box' && variantRaw !== 'caged') return { screen: 'learn' };

  const judgeRaw = params.get('judge') ?? 'fixed';
  if (judgeRaw !== 'pitch' && judgeRaw !== 'fixed') return { screen: 'learn' };

  const span = parsePositiveInt(params.get('span')) ?? 4;

  // Mic input works for box/caged, or the octave run judged by pitch; coerce
  // otherwise (octave + fixed fingering can't be verified by pitch alone).
  const micOk = variantRaw !== 'octave' || judgeRaw === 'pitch';
  let inputMode: 'click' | 'mic' = params.get('input') === 'mic' ? 'mic' : 'click';
  if (inputMode === 'mic' && !micOk) {
    inputMode = 'click';
  }

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
    playSound: parseBool(params.get('sound'), true),
    drone: parseBool(params.get('drone'), false),
    highlightCharacteristic: parseBool(params.get('char'), false),
    fixedRootNote: parseFixedRoot(params.get('root')),
    inputMode,
    micSensitivity: parseUnit(params.get('sens'), DEFAULT_MIC_SENSITIVITY),
    micDeviceId: null, // device ids are browser-specific; not carried in the URL
    displayNotePercentage: parsePercentage(params.get('show'), 100)
  };
  return { screen: 'session', config };
}

function parseIdentifyMode(params: URLSearchParams): Route {
  const enabledModes = parseModes(params.get('modes'));
  if (enabledModes === null) return { screen: 'learn' };

  const duration = parseDuration(params.get('duration'));
  if (duration === null) return { screen: 'learn' };

  const frets = parsePositiveInt(params.get('frets'));
  if (frets === null) return { screen: 'learn' };

  const pmodeRaw = params.get('pmode');
  const promptMode: 'visual' | 'audio' = pmodeRaw === 'audio' ? 'audio' : 'visual';

  const config: IdentifyModeConfig = {
    exercise: 'identify-mode',
    enabledModes,
    maxFret: frets,
    durationSec: duration.durationSec,
    continuous: duration.continuous,
    showFretNumbers: parseBool(params.get('fretnums'), true),
    playSound: parseBool(params.get('sound'), true),
    drone: parseBool(params.get('drone'), false),
    highlightCharacteristic: parseBool(params.get('char'), false),
    fixedRootNote: parseFixedRoot(params.get('root')),
    promptMode,
    displayNotePercentage: parsePercentage(params.get('show'), 100)
  };
  return { screen: 'session', config };
}

// Comma list where every item is in `valid`; null if absent, empty or invalid.
function parseList<T extends string>(raw: string | null, valid: readonly string[]): T[] | null {
  const parts = (raw ?? '').split(',').filter(p => p.length > 0);
  return parts.length > 0 && parts.every(p => valid.includes(p)) ? (parts as T[]) : null;
}

function parseCaged(params: URLSearchParams): Route {
  const enabledShapes = parseList<CagedConfig['enabledShapes'][number]>(params.get('shapes'), CAGED_ORDER);
  const qualities = parseList<CagedConfig['qualities'][number]>(params.get('quals'), ['major', 'minor']);
  const duration = parseDuration(params.get('duration'));
  const frets = parsePositiveInt(params.get('frets'));
  if (!enabledShapes || !qualities || !duration || frets === null) return { screen: 'learn' };
  const cagedVariant = parseEnum(params.get('cvar'), new Set(['find-tones', 'name-shape', 'next-shape']), 'find-tones' as const);
  const config: CagedConfig = {
    exercise: 'caged',
    cagedVariant,
    enabledShapes,
    qualities,
    include7th: parseBool(params.get('sev'), false),
    fixedRootNote: parseFixedRoot(params.get('root')),
    maxFret: frets,
    durationSec: duration.durationSec,
    continuous: duration.continuous,
    showFretNumbers: parseBool(params.get('fretnums'), true),
    playSound: parseBool(params.get('sound'), true),
    // Mic only judges find-tones.
    inputMode: params.get('input') === 'mic' && cagedVariant === 'find-tones' ? 'mic' : 'click',
    micSensitivity: parseUnit(params.get('sens'), DEFAULT_MIC_SENSITIVITY),
    micDeviceId: null
  };
  return { screen: 'session', config };
}

export function parseHash(hash: string): Route {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (h === '/learn') return { screen: 'learn' };
  if (h === '/ideate') return { screen: 'ideate' };
  // '/session' is the pre-sections path; old recents and bookmarks still use it.
  if (!h.startsWith('/learn/session') && !h.startsWith('/session')) return { screen: 'home' };

  const qIdx = h.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? h.slice(qIdx + 1) : '');

  const ex = params.get('ex') ?? 'root-notes';
  if (VALID_FRETBOARD_EXERCISES.has(ex)) return parseFretboard(params, ex as ExerciseKind);
  if (ex === 'play-shape') return parsePlayShape(params);
  if (ex === 'identify-mode') return parseIdentifyMode(params);
  if (ex === 'caged') return parseCaged(params);
  return { screen: 'learn' };
}

export function sessionHash(config: AnyConfig): string {
  const params = new URLSearchParams();
  params.set('ex', config.exercise);

  if (config.exercise === 'play-shape') {
    params.set('modes', config.enabledModes.join(','));
    params.set('variant', config.shapeVariant);
    params.set('judge', config.octaveJudge);
    params.set('span', String(config.boxSpan));
    params.set('duration', config.continuous ? 'continuous' : String(config.durationSec));
    params.set('frets', String(config.maxFret));
    params.set('fretnums', config.showFretNumbers ? '1' : '0');
    params.set('sound', config.playSound ? '1' : '0');
    params.set('drone', config.drone ? '1' : '0');
    params.set('char', config.highlightCharacteristic ? '1' : '0');
    params.set('root', config.fixedRootNote ?? 'random');
    params.set('input', config.inputMode);
    params.set('sens', String(config.micSensitivity));
    params.set('show', String(config.displayNotePercentage));
  } else if (config.exercise === 'caged') {
    params.set('cvar', config.cagedVariant);
    params.set('shapes', config.enabledShapes.join(','));
    params.set('quals', config.qualities.join(','));
    params.set('sev', config.include7th ? '1' : '0');
    params.set('root', config.fixedRootNote ?? 'random');
    params.set('duration', config.continuous ? 'continuous' : String(config.durationSec));
    params.set('frets', String(config.maxFret));
    params.set('fretnums', config.showFretNumbers ? '1' : '0');
    params.set('sound', config.playSound ? '1' : '0');
    params.set('input', config.inputMode);
    params.set('sens', String(config.micSensitivity));
  } else if (config.exercise === 'identify-mode') {
    params.set('modes', config.enabledModes.join(','));
    params.set('duration', config.continuous ? 'continuous' : String(config.durationSec));
    params.set('frets', String(config.maxFret));
    params.set('fretnums', config.showFretNumbers ? '1' : '0');
    params.set('sound', config.playSound ? '1' : '0');
    params.set('drone', config.drone ? '1' : '0');
    params.set('char', config.highlightCharacteristic ? '1' : '0');
    params.set('root', config.fixedRootNote ?? 'random');
    params.set('pmode', config.promptMode);
    params.set('show', String(config.displayNotePercentage));
  } else {
    params.set('note', config.targetNote);
    params.set('duration', config.continuous ? 'continuous' : String(config.durationSec));
    params.set('frets', String(config.maxFret));
    params.set('roots', config.showRootMarkers ? '1' : '0');
    params.set('labels', config.showAllLabels ? '1' : '0');
    params.set('fretnums', config.showFretNumbers ? '1' : '0');
    params.set('sound', config.playSound ? '1' : '0');
    params.set('algo', config.algorithm);
    params.set('int', config.intervalKind);
    params.set('keyroot', config.keyRoot);
    params.set('keyqual', config.keyQuality);
    params.set('dir', config.direction);
  }
  return SESSION_PREFIX + params.toString();
}

// The one hash each route is shown under; the app rewrites the URL to it.
export function canonicalHash(route: Route): string {
  switch (route.screen) {
    case 'home': return HOME_HASH;
    case 'learn': return LEARN_HASH;
    case 'ideate': return IDEATE_HASH;
    case 'session': return sessionHash(route.config);
  }
}
