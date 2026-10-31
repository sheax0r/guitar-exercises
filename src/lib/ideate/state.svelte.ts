// Ideate state: the live settings, shared UI bits (status line, count-in flash), and the
// render queue. Each job owns its audio, a settings snapshot, the raw notes and the tab.
// Jobs render one at a time and persist in IndexedDB (Whistler's DB name, so old jobs load).
import { getAudioContext } from '../audio/context';
import { loadCalibMs } from '../audio/calibration';
import { detectNotes, INSTR } from '../transcribe/detect';
import { firstMidi, mapNotes } from '../transcribe/quantize';
import { buildScore, exportScore, loadAlphaTab } from '../transcribe/score';
import type { Stem } from '../transcribe/separate';
import type { DetectSettings, Instrument, RawNote } from '../transcribe/types';

export interface JobSettings extends DetectSettings {
  bpm: number;
  num: number;
  den: number;
  snap: boolean;
  startNote: number;
  cleanup: boolean;
  sep: boolean;
  stem: Stem;
}

export type JobStatus = 'queued' | 'rendering' | 'done' | 'error' | 'cancelled';
export interface Job {
  id: string;
  name: string;
  createdAt: number;
  status: JobStatus;
  settings: JobSettings;
  audio: Blob;
  rawNotes?: RawNote[];
  gpBytes?: Uint8Array;
  anchor?: number;
  octShift?: number;
  offset?: number; // ms
  clean?: boolean;
  error?: string;
  // not persisted
  progress?: number;
  phase?: 'separating' | 'transcribing';
}

// ---------- live settings (what the next recording / upload uses) ----------
export const settings = $state({
  bpm: 120,
  num: 4,
  den: 4,
  instrument: 'guitar' as Instrument,
  startNote: INSTR.guitar.start,
  engine: 'pitchy' as DetectSettings['engine'],
  deviceId: null as string | null,
  sep: false,
  stem: 'other' as Stem,
  countIn: true,
  metro: true,
  playPitch: true,
  snap: !INSTR.guitar.absolute, // off when the input's pitch is reliable (guitar)
  metroVol: 0.5,
  clarity: 0.9,
  minMs: 90,
  mergeMs: 80
});

export function setInstrument(i: Instrument) {
  settings.instrument = i;
  settings.snap = !INSTR[i].absolute;
  settings.startNote = INSTR[i].start;
}

export const snapshotSettings = (): JobSettings => {
  const s = settings;
  return {
    engine: s.engine, bpm: s.bpm, num: s.num, den: s.den, instrument: s.instrument, snap: s.snap,
    startNote: s.startNote, clarity: s.clarity, minMs: s.minMs, mergeMs: s.mergeMs,
    cleanup: false, // new jobs start with cleanup off; it's a per-job tweak in the panel
    sep: s.sep, stem: s.stem
  };
};

// ---------- shared UI ----------
export const ui = $state({
  status: 'tap REC to start',
  flash: null as number | null, // count-in number shown over the REC button
  recording: false,
  drawerOpen: false,
  calibMs: loadCalibMs(), // calibrated latency -> default timing offset for new jobs
  currentId: null as string | null // job open in the cleanup panel
});

// Show `n` over the REC button after `delayMs`; hideAfterMs clears it again.
export function flashBeat(n: number, delayMs: number, hideAfterMs?: number) {
  setTimeout(() => {
    ui.flash = n;
    if (hideAfterMs) setTimeout(() => (ui.flash = null), hideAfterMs);
  }, delayMs);
}

export const audioCtx = (): AudioContext => {
  const ctx = getAudioContext();
  if (!ctx) throw new Error('Web Audio unavailable');
  return ctx;
};

// ---------- IndexedDB ----------
const DB_NAME = 'whistler', STORE = 'jobs';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbTx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode), rq = fn(tx.objectStore(STORE));
    tx.oncomplete = () => res(rq.result);
    tx.onerror = () => rej(tx.error);
  });
}

// persist everything except transient progress (the alphaTab score is never stored)
function persist(j: Job) {
  const { progress: _p, phase: _ph, ...rest } = $state.snapshot(j) as Job;
  return idbTx('readwrite', s => s.put(rest)).catch(e => console.warn('persist', e));
}

// ---------- queue ----------
export const queue = $state({ jobs: [] as Job[] });
let pumping = false;

export const currentJob = () => queue.jobs.find(j => j.id === ui.currentId) ?? null;

export async function enqueue(blob: Blob, name: string) {
  const job: Job = { id: crypto.randomUUID(), name, createdAt: Date.now(), status: 'queued', settings: snapshotSettings(), audio: blob };
  queue.jobs.push(job);
  ui.drawerOpen = true;
  await persist(job);
  pump();
}

// Anchor for a fresh transcription: pitchy + snap -> the chosen start note (relative);
// otherwise the take's own first note (absolute), kept in guitar range.
export const anchorFor = (raw: RawNote[], S: JobSettings) =>
  S.engine === 'pitchy' && S.snap ? S.startNote : Math.max(40, Math.min(88, firstMidi(raw)));

// Build the alphaTab score and .gp bytes for a finished job. Needs alphaTab loaded.
export function renderJob(job: Job) {
  const { bpm, num, den } = job.settings;
  const notes = mapNotes(job.rawNotes!, job.anchor! + 12 * (job.octShift ?? 0), (job.offset ?? 0) / 1000); // offset absorbs latency
  const score = buildScore(notes, bpm, num, den, { rhythm: job.clean, voicing: job.clean });
  job.gpBytes = exportScore(score);
  return score;
}

export const decode = async (blob: Blob) => audioCtx().decodeAudioData(await blob.arrayBuffer());

async function pump(): Promise<void> {
  if (pumping) return;
  const job = queue.jobs.find(j => j.status === 'queued');
  if (!job) return;
  pumping = true;
  job.status = 'rendering';
  job.progress = 0;
  try {
    let audio = await decode(job.audio);
    if (job.settings.sep) {
      job.phase = 'separating';
      const { separate } = await import('../transcribe/separate');
      audio = await separate(audio, job.settings.stem, p => (job.progress = p));
    }
    if ((job.status as JobStatus) !== 'cancelled') {
      job.phase = 'transcribing';
      job.progress = 0;
      const raw = await detectNotes(audio, job.settings, p => (job.progress = p));
      if ((job.status as JobStatus) === 'cancelled') {
        /* user bailed mid-render; keep cancelled */
      } else if (!raw.length) {
        job.status = 'error';
        job.error = 'nothing detected';
      } else {
        job.rawNotes = raw;
        job.anchor = anchorFor(raw, job.settings);
        job.octShift = 0;
        job.offset = ui.calibMs; // start from the calibrated latency offset
        job.clean = job.settings.cleanup;
        await loadAlphaTab();
        renderJob(job); // builds gpBytes headless
        job.status = 'done';
      }
    }
  } catch (e) {
    console.warn('job failed:', e);
    job.status = 'error';
    job.error = String(e);
  }
  await persist(job);
  pumping = false;
  pump();
}

export function cancelJob(job: Job) {
  if (job.status === 'queued' || job.status === 'rendering') {
    job.status = 'cancelled';
    persist(job);
  }
}

export async function removeJob(job: Job) {
  queue.jobs = queue.jobs.filter(j => j.id !== job.id);
  if (ui.currentId === job.id) ui.currentId = null;
  await idbTx('readwrite', s => s.delete(job.id)).catch(e => console.warn('delete', e));
}

export const saveJob = persist;

// Load persisted jobs once; anything left mid-render (a reload interrupted it) re-queues.
let loaded = false;
export async function loadJobs() {
  if (loaded || typeof indexedDB === 'undefined') return;
  loaded = true;
  try {
    const all = ((await idbTx('readonly', s => s.getAll())) as Job[]) || [];
    for (const j of all) if (j.status === 'rendering') j.status = 'queued';
    queue.jobs = all.sort((a, b) => a.createdAt - b.createdAt);
    pump();
  } catch (e) {
    console.warn('queue load failed:', e);
  }
}
