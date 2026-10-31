// Two scorers.
// scoreNotes: a sung/whistled SONG against its melody (pitch in semitones, timing in beats).
//  - pitch: global alignment tried at every transposition (key/octave/anchor-invariant) ->
//    precision/recall/F1. Match +2, substitution -2, gap -1, so it maximises matched notes.
//  - timing: on matched pairs, fit detected_start = a + b*expected_pos robustly (Theil-Sen), so
//    tempo needn't be known; onset = share of expected notes whose residual is within `tol` beats.
// scoreAnnot: a recording against note ANNOTATIONS (absolute pitch and seconds), mir_eval-style:
//    a detected note matches if the rounded pitch is equal and the onset is within `tol` seconds,
//    one-to-one. onset = share of expected notes with any detected onset within `tol`.
export interface Expected {
  semi: number;
  pos: number;
}
export interface Detected {
  midi: number;
  start: number;
}
export interface Score {
  nDet: number;
  nExp: number;
  matches: number;
  precision: number;
  recall: number;
  f1: number;
  onset: number;
  trace: string;
  shift?: number | null;
  tempoScale?: number | null;
  medResid?: number | null;
}

type Op = { op: '=' | 'x' | '+' | '-'; i?: number; j?: number };

function align(a: number[], b: number[]) {
  const n = a.length, m = b.length, S: Float64Array[] = [], T: Uint8Array[] = [];
  for (let i = 0; i <= n; i++) {
    S.push(new Float64Array(m + 1));
    T.push(new Uint8Array(m + 1));
  }
  for (let i = 1; i <= n; i++) {
    S[i][0] = -i;
    T[i][0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    S[0][j] = -j;
    T[0][j] = 2;
  }
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const d = S[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 2 : -2), u = S[i - 1][j] - 1, l = S[i][j - 1] - 1;
      if (d >= u && d >= l) {
        S[i][j] = d;
        T[i][j] = 0;
      } else if (u >= l) {
        S[i][j] = u;
        T[i][j] = 1;
      } else {
        S[i][j] = l;
        T[i][j] = 2;
      }
    }
  const ops: Op[] = []; // '=' match, 'x' wrong pitch, '+' extra detected, '-' missed
  let i = n, j = m, matches = 0;
  while (i > 0 || j > 0) {
    const t = i > 0 && j > 0 ? T[i][j] : i > 0 ? 1 : 2;
    if (t === 0) {
      const eq = a[i - 1] === b[j - 1];
      if (eq) matches++;
      ops.push({ op: eq ? '=' : 'x', i: i - 1, j: j - 1 });
      i--;
      j--;
    } else if (t === 1) {
      ops.push({ op: '+', i: i - 1 });
      i--;
    } else {
      ops.push({ op: '-', j: j - 1 });
      j--;
    }
  }
  return { matches, subs: ops.filter(o => o.op === 'x').length, ops: ops.reverse() };
}

const med = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y), k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};

export function scoreNotes(detected: Detected[], expected: Expected[], { tol = 0.25 } = {}): Score {
  const det = [...detected].sort((x, y) => x.start - y.start), dm = det.map(n => Math.round(n.midi)), es = expected.map(e => e.semi);
  const out: Score = { nDet: det.length, nExp: expected.length, matches: 0, precision: 0, recall: 0, f1: 0, onset: 0, shift: null, tempoScale: null, medResid: null, trace: '' };
  if (!det.length || !expected.length) return out;
  let best: (ReturnType<typeof align> & { shift: number }) | null = null;
  for (let s = Math.min(...dm) - Math.max(...es); s <= Math.max(...dm) - Math.min(...es); s++) {
    const al = align(dm, es.map(x => x + s));
    // tie: more paired notes
    if (!best || al.matches > best.matches || (al.matches === best.matches && al.subs > best.subs)) best = { ...al, shift: s };
  }
  const b0 = best!;
  out.matches = b0.matches;
  out.shift = b0.shift;
  out.precision = b0.matches / det.length;
  out.recall = b0.matches / expected.length;
  out.f1 = out.precision + out.recall ? (2 * out.precision * out.recall) / (out.precision + out.recall) : 0;
  out.trace = b0.ops.map(o => o.op).join('');

  const P = b0.ops.filter(o => o.op === '=').map(o => ({ x: expected[o.j!].pos, y: det[o.i!].start }));
  if (P.length >= 3) {
    const slopes: number[] = [];
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (P[j].x !== P[i].x) slopes.push((P[j].y - P[i].y) / (P[j].x - P[i].x));
    const b = med(slopes);
    if (b > 0) {
      const a = med(P.map(p => p.y - b * p.x)), res = P.map(p => Math.abs((p.y - a - b * p.x) / b));
      out.tempoScale = b; // seconds per pos-unit (60/b = BPM when pos is in beats)
      out.medResid = med(res);
      out.onset = res.filter(r => r <= tol).length / expected.length; // missed notes count against timing too
    }
  }
  return out;
}

export function scoreAnnot(detected: Detected[], expected: Expected[], { tol = 0.05 } = {}): Score {
  const det = [...detected].sort((x, y) => x.start - y.start), exp = [...expected].sort((x, y) => x.pos - y.pos);
  const out: Score = { nDet: det.length, nExp: exp.length, matches: 0, precision: 0, recall: 0, f1: 0, onset: 0, trace: '' };
  if (!det.length || !exp.length) return out;
  // per pitch, greedy earliest-available within the window is a maximum one-to-one matching
  const used = new Set<number>(), hit: string[] = new Array(exp.length).fill('-');
  for (let j = 0; j < exp.length; j++) {
    const e = exp[j], i = det.findIndex((d, k) => !used.has(k) && Math.round(d.midi) === e.semi && Math.abs(d.start - e.pos) <= tol);
    if (i >= 0) {
      used.add(i);
      hit[j] = '=';
    } else if (det.some(d => Math.abs(d.start - e.pos) <= tol)) hit[j] = 'x'; // something started there, wrong pitch
  }
  out.matches = used.size;
  out.precision = used.size / det.length;
  out.recall = used.size / exp.length;
  out.f1 = out.precision + out.recall ? (2 * out.precision * out.recall) / (out.precision + out.recall) : 0;
  out.onset = hit.filter(h => h !== '-').length / exp.length;
  out.trace = hit.join('') + (det.length > used.size ? ` +${det.length - used.size}` : '');
  return out;
}
