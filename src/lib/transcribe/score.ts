// Tab notes -> alphaTex -> alphaTab score -> Guitar Pro (.gp) bytes.
// alphaTab loads lazily from its CDN script (only on Ideate); see loadAlphaTab.
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { chordFrets, type Fretted } from './fretting';
import { durToken, largestPow2, tokSixteenths, toSixteenths } from './quantize';
import type { TabNote } from './types';

export const ALPHATAB_VERSION = '1.8.4';
const ALPHATAB_BASE = `https://cdn.jsdelivr.net/npm/@coderline/alphatab@${ALPHATAB_VERSION}/dist`;
export const SOUNDFONT_URL = `${ALPHATAB_BASE}/soundfont/sonivox.sf2`;

// alphaTab's UMD global. Typed loosely: it's a CDN script, not an npm dependency.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AlphaTabGlobal = any;
let loading: Promise<AlphaTabGlobal> | null = null;

// Injects the alphaTab <script> once; resolves with the global.
export function loadAlphaTab(): Promise<AlphaTabGlobal> {
  const g = (globalThis as { alphaTab?: AlphaTabGlobal }).alphaTab;
  if (g) return Promise.resolve(g);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${ALPHATAB_BASE}/alphaTab.min.js`;
    s.onload = () => resolve((globalThis as { alphaTab?: AlphaTabGlobal }).alphaTab);
    s.onerror = () => {
      loading = null; // allow a retry after a network blip
      reject(new Error('alphaTab failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

function alphaTab(): AlphaTabGlobal {
  const g = (globalThis as { alphaTab?: AlphaTabGlobal }).alphaTab;
  if (!g) throw new Error('alphaTab not loaded: await loadAlphaTab() first');
  return g;
}

export interface TexOptions {
  rhythm?: boolean; // split durations into bar-aligned power-of-two pieces + ties (no dots)
  voicing?: boolean; // fret each event near the previous one instead of always lowest
}

export function buildTex(notes: TabNote[], bpm: number, num: number, den: number, opts: TexOptions = {}): string {
  const barSixteenths = num * (16 / den), sixteenth = 60 / bpm / 4;
  // group near-simultaneous onsets into chord events (polyphonic engines); mono stays size-1 groups
  const win = Math.min(0.04, sixteenth * 0.5);
  const events: Array<{ start: number; dur: number; midis: number[] }> = [];
  for (const n of [...notes].sort((a, b) => a.start - b.start)) {
    const e = events[events.length - 1];
    if (e && Math.abs(n.start - e.start) <= win) {
      e.midis.push(Math.round(n.midi));
      e.dur = Math.max(e.dur, n.dur);
    } else events.push({ start: n.start, dur: n.dur, midis: [Math.round(n.midi)] });
  }

  let out = `\\title "Whistle" \\tempo ${bpm} \\ts ${num} ${den} .`, inBar = 0, prevEnd = 0;
  let prevFret: number | null = null;
  const add = (tok: string) => {
    out += ' ' + tok;
    inBar += tokSixteenths(tok);
    while (inBar >= barSixteenths) {
      out += ' |';
      inBar -= barSixteenths;
    }
  };
  const beat = (fr: Fretted[], dtok: string, tie: boolean) =>
    !fr.length
      ? `r.${dtok}`
      : fr.length > 1
        ? `(${fr.map(f => `${tie ? '-' : f.fret}.${f.str}`).join(' ')}).${dtok}`
        : `${tie ? '-' : fr[0].fret}.${fr[0].str}.${dtok}`;
  const emitTied = (fr: Fretted[], n: number) => {
    let rem = n, first = true;
    while (rem > 0) {
      const v = largestPow2(Math.min(rem, barSixteenths - inBar));
      add(beat(fr, durToken(v), !first));
      rem -= v;
      first = false;
    }
  };
  const emitRest = (n: number) => {
    let rem = n;
    while (rem > 0) {
      const v = largestPow2(Math.min(rem, barSixteenths - inBar));
      add(`r.${durToken(v)}`);
      rem -= v;
    }
  };

  for (const e of events) {
    // rests split freely (no ties needed), so always bar-align: multi-bar gaps don't collapse to one whole rest
    if (e.start - prevEnd > sixteenth * 0.5) emitRest(toSixteenths(e.start - prevEnd, bpm));
    const fr = chordFrets(e.midis, opts.voicing ? prevFret : null);
    const dur16 = toSixteenths(e.dur, bpm);
    if (opts.rhythm) emitTied(fr, dur16);
    else add(beat(fr, durToken(dur16), false));
    if (fr.length) prevFret = Math.min(...fr.map(f => f.fret));
    prevEnd = e.start + e.dur;
  }
  return out;
}

// alphaTab exports MIDI-only sounds; GP8 plays via RSE, so it's silent without a patch.
// Inject one (patch taken from a known-good GP8 file).
export function makeAudible(bytes: Uint8Array): Uint8Array {
  try {
    const files = unzipSync(bytes), key = 'Content/score.gpif';
    const g = strFromU8(files[key])
      .replace(/<\/MIDI>\s*<\/Sound>/g, '</MIDI><RSE><SoundbankPatch>D-Steel</SoundbankPatch><ElementsSettings></ElementsSettings></RSE></Sound>')
      .replace(/<AudioEngineState>MIDI<\/AudioEngineState>/g, '<AudioEngineState>RSE</AudioEngineState>');
    files[key] = strToU8(g);
    return zipSync(files);
  } catch (e) {
    console.warn('RSE inject failed, raw export:', e);
    return bytes;
  }
}

export function buildScore(notes: TabNote[], bpm: number, num: number, den: number, opts?: TexOptions): AlphaTabGlobal {
  const at = alphaTab();
  const imp = new at.importer.AlphaTexImporter();
  imp.initFromString(buildTex(notes, bpm, num, den, opts), new at.Settings());
  const score = imp.readScore();
  let ch = 0; // program 25 = steel guitar; used by both export and the in-app player
  for (const t of score.tracks) {
    const pi = t.playbackInfo;
    if (!pi) continue;
    pi.program = 25;
    pi.volume = 16;
    pi.isMute = false;
    pi.isSolo = false;
    pi.primaryChannel = ch;
    pi.secondaryChannel = ch + 1;
    ch += 2;
    pi.port = 1;
  }
  return score;
}

export const exportScore = (score: AlphaTabGlobal): Uint8Array => {
  const at = alphaTab();
  return makeAudible(new at.exporter.Gp7Exporter().export(score, new at.Settings()));
};
