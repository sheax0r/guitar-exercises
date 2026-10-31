// Dev-only transcription harness (ideate-test.html, served by `npm run dev`, not built):
// runs every fixture through the real pipeline and scores it.
// URL params: ?engines=pitchy,ai,learn  ?only=<fixture id substring>.
// "learn" replays guitar takes through Learn's live mic judging (see learn.ts).
// Results: window.__results, window.__done.
import { detectNotes } from '../detect';
import { firstMidi, mapNotes } from '../quantize';
import { buildScore, exportScore, loadAlphaTab } from '../score';
import { hzToMidi } from '../../audio/pitchMath';
import type { Engine, TabNote } from '../types';
import { FIXTURES, type Fixture } from './fixtures';
import { scoreNotes, scoreAnnot, type Expected, type Score } from './scoring';
import { synthMelody } from './synth';
import { LEARN_EXPECT, jamsNotes, learnOnsets, scoreLearn } from './learn';
import { HAPPY_BIRTHDAY, withPos, songToNotes } from './songs';

const $ = (id: string) => document.getElementById(id)!;
const P = new URLSearchParams(location.search);
const ENGINES = (P.get('engines') || 'pitchy,ai,learn').split(',') as Array<Engine | 'learn'>, ONLY = P.get('only');
const DETECT = { clarity: 0.9, minMs: 90, mergeMs: 80 }; // the app's default detection settings
const SONGS = { 'happy-birthday': HAPPY_BIRTHDAY };
const EXTS = ['wav', 'flac', 'webm', 'ogg', 'm4a', 'mp3'];
const BASE = 'test/'; // fixture paths are relative to test/
const decoder = new OfflineAudioContext(1, 1, 44100);
type Row = Partial<Score> & { id: string; engine: string; status: string; note?: string; unit?: string; ms?: number; threshold?: unknown; view?: () => void };
const results: Row[] = ((window as unknown as { __results: Row[] }).__results = []);

async function fetchFirst(paths: string[]) {
  for (const p of paths) {
    const r = await fetch(BASE + p);
    // Vite's dev server answers unknown paths with index.html; only accept non-HTML bodies.
    if (r.ok && !(r.headers.get('content-type') || '').includes('text/html')) return { path: p, buf: await r.arrayBuffer() };
  }
  return null;
}
async function loadAudio(fx: Fixture): Promise<{ buf: AudioBuffer } | null> {
  if (fx.synth) {
    const sr = 44100, data = synthMelody(SONGS[fx.song!], { ...fx.synth, sr });
    const buf = new AudioBuffer({ length: data.length, sampleRate: sr, numberOfChannels: 1 });
    buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    return { buf };
  }
  const f = fx.file!;
  const got = await fetchFirst(/\.\w+$/.test(f) ? [f] : EXTS.map(e => `${f}.${e}`));
  return got && { buf: await decoder.decodeAudioData(got.buf) };
}
async function loadExpected(fx: Fixture): Promise<{ notes: Expected[]; tol: number } | null> {
  if (fx.song) return { notes: withPos(SONGS[fx.song]).map(n => ({ semi: n.semi, pos: n.pos })), tol: 0.25 };
  const got = await fetchFirst([fx.annot!.file]);
  if (!got) return null;
  const text = new TextDecoder().decode(got.buf);
  const notes: Expected[] =
    fx.annot!.format === 'vocadito-csv'
      ? text.trim().split(/\r?\n/).map(l => l.split(',').map(Number)).map(([t, hz]) => ({ semi: hzToMidi(hz), pos: t }))
      : JSON.parse(text)
          .annotations.filter((a: { namespace: string }) => a.namespace === 'note_midi')
          .flatMap((a: { data: unknown[] }) => a.data)
          .map((d: { value: number; time: number }) => ({ semi: Math.round(d.value), pos: d.time }));
  return { notes: notes.sort((a, b) => a.pos - b.pos), tol: 0.05 };
}

// ---------- tab view ----------
let at: any = null;
async function showTab(title: string, notes: TabNote[], bpm: number, num = 4, den = 4, gp = false) {
  const alphaTab = await loadAlphaTab();
  at = at || new alphaTab.AlphaTabApi($('view'), { player: { enablePlayer: false } });
  const score = buildScore(notes, bpm, num, den, { rhythm: true, voicing: true });
  $('viewtitle').textContent = title;
  at.renderScore(score);
  if (gp) {
    const a = document.createElement('a');
    a.download = 'happy-birthday-reference.gp';
    a.href = URL.createObjectURL(new Blob([exportScore(score) as BlobPart]));
    a.click();
  }
}
const REF = 'Reference: Happy Birthday (G3, 100 BPM, 3/4)';
$('ref').onclick = () => showTab(REF, songToNotes(HAPPY_BIRTHDAY, 55, 100), 100, 3, 4);
$('refgp').onclick = () => showTab(REF, songToNotes(HAPPY_BIRTHDAY, 55, 100), 100, 3, 4, true);

// ---------- table ----------
const pct = (x?: number | null) => (x == null ? '–' : Math.round(x * 100) + '%');
function row(r: Row, fx?: Fixture) {
  const tr = document.createElement('tr');
  tr.className = r.status;
  const bpm = r.tempoScale && r.unit === 'beat' ? Math.round(60 / r.tempoScale) : r.tempoScale ? `×${r.tempoScale.toFixed(2)}` : '–';
  tr.innerHTML = `<td>${r.id}<div class="src">${fx ? fx.source + ' · ' + fx.license : ''}</div></td><td>${r.engine}</td>
    <td class="st">${r.status}</td><td>${r.note || ''}${r.nDet != null ? `${r.matches}/${r.nExp} matched, ${r.nDet} detected` : ''}</td>
    <td>${pct(r.f1)}</td><td>${pct(r.onset)}</td><td>${bpm}</td><td>${r.ms != null ? (r.ms / 1000).toFixed(1) + 's' : ''}</td>
    <td>${r.view ? '<button>tab</button>' : ''}${r.trace ? `<code>${r.trace}</code>` : ''}</td>`;
  if (r.view) tr.querySelector('button')!.onclick = r.view;
  $('rows').appendChild(tr);
  const { view: _view, ...plain } = r;
  results.push(plain);
}

// (The scorer's own self-checks moved to vitest: harness/harness.test.ts.)
for (const fx of FIXTURES.filter(f => !ONLY || f.id.includes(ONLY))) {
  let audio, expected;
  try {
    [audio, expected] = await Promise.all([loadAudio(fx), loadExpected(fx)]);
  } catch (e) {
    for (const engine of ENGINES) row({ id: fx.id, engine, status: 'ERROR', note: String(e) }, fx);
    continue;
  }
  if (!audio || !expected) {
    const what = !audio
      ? `audio missing: test/${fx.file}${/\.\w+$/.test(fx.file!) ? '' : '.*'}`
      : `annotation missing: test/${fx.annot!.file}`;
    for (const engine of ENGINES) row({ id: fx.id, engine, status: 'SKIP', note: what }, fx);
    continue;
  }
  for (const engine of ENGINES) {
    if (engine === 'learn') {
      const th = LEARN_EXPECT[fx.id];
      if (!th) continue;
      const t0 = performance.now();
      const annot = jamsNotes(new TextDecoder().decode((await fetchFirst([fx.annot!.file]))!.buf));
      const s = scoreLearn(learnOnsets(audio.buf.getChannelData(0), audio.buf.sampleRate), annot);
      const status = s.recall >= th.recall && s.precision >= th.precision ? 'PASS' : 'FAIL';
      row({ id: fx.id, engine, status, ms: performance.now() - t0, threshold: th,
        note: `heard ${Math.round(s.recall * 100)}% of ${s.nExp} notes, ${Math.round(s.precision * 100)}% of ${s.nDet} onsets right` }, fx);
      continue;
    }
    $('status').textContent = `running ${fx.id} · ${engine}…`;
    const t0 = performance.now();
    try {
      const raw = await detectNotes(audio.buf, { ...DETECT, engine, instrument: fx.instrument });
      const notes = raw.length ? mapNotes(raw, firstMidi(raw)) : [];
      const s = (fx.annot ? scoreAnnot : scoreNotes)(notes, expected.notes, { tol: expected.tol });
      const th = fx.expect?.[engine];
      const status = !th ? 'INFO' : s.f1 >= th.f1 && s.onset >= th.onset ? 'PASS' : 'FAIL';
      const song = fx.song ? SONGS[fx.song] : null;
      const bpm = fx.bpm || (s.tempoScale && song ? Math.round(60 / s.tempoScale) : 100);
      row(
        { id: fx.id, engine, status, ...s, unit: song ? 'beat' : 's', ms: performance.now() - t0, threshold: th || null,
          view: () => showTab(`${fx.id} · ${engine} (as transcribed, ${bpm} BPM)`, notes, bpm, song ? song.num : 4, song ? song.den : 4) },
        fx
      );
    } catch (e) {
      console.warn(fx.id, engine, e);
      row({ id: fx.id, engine, status: 'ERROR', note: String(e) }, fx);
    }
  }
}

const n = (k: string) => results.filter(r => r.status === k).length;
$('status').textContent = `done — ${n('PASS')} pass · ${n('FAIL')} fail · ${n('INFO')} info · ${n('SKIP')} skip · ${n('ERROR')} error`;
document.title = `${n('FAIL') + n('ERROR') ? '✗' : '✓'} Ideate transcription tests`;
(window as unknown as { __done: boolean }).__done = true;
