// Pure transcription pipeline: shared by the app (app.js) and the test harness (test/).
// No DOM access. buildScore/exportScore need the alphaTab UMD global on the page.
import { PitchDetector } from 'https://cdn.jsdelivr.net/npm/pitchy@4.1.0/+esm';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';

// alphaTex string numbering: 1..6 = high E..low E. Matches the <String> values in a GP8 gpif.
const OPEN = [64,59,55,50,45,40];               // midi of open strings, string 1..6
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// ---------- pure helpers (self-tested in app.js; pipeline covered by test/) ----------
const hzToMidi = hz => 69 + 12*Math.log2(hz/440);
const midiToHz = m => 440*Math.pow(2,(m-69)/12);
const noteName = m => NAMES[((m%12)+12)%12] + (Math.floor(m/12)-1);
const median = a => { const s=[...a].sort((x,y)=>x-y); return s[s.length>>1]; };

// greedy lowest-fret position. ponytail: no hand-movement cost; upgrade to shortest-path if tabs look jumpy.
function midiToFret(midi){
  let best=null;
  for(let s=0;s<6;s++){ const fret=midi-OPEN[s];
    if(fret>=0 && fret<=24 && (best===null || fret<best.fret)) best={str:s+1,fret}; }
  return best;
}
const toSixteenths = (sec,bpm) => Math.max(1, Math.round(sec/(60/bpm/4)));  // grid = 16ths of a quarter
// ponytail: nearest single base value, no dots/ties. Known ceiling.
const durToken = n => n>=16?'1':n>=8?'2':n>=4?'4':n>=2?'8':'16';
const tokSixteenths = tok => ({'1':16,'2':8,'4':4,'8':2,'16':1})[tok.split('.').pop()]||1;

// assign each midi to a free string. prevFret null -> greedy lowest fret; else nearest to prevFret (voicing: minimize hand travel).
// ponytail: greedy nearest-to-prev, not a global shortest-path; drops notes that don't fit on a free string.
function chordFrets(midis, prevFret){
  const used=new Set(), out=[];
  for(const m of [...midis].sort((a,b)=>a-b)){      // low to high
    let best=null;
    for(let s=0;s<6;s++){ if(used.has(s)) continue; const fret=m-OPEN[s];
      if(fret<0||fret>24) continue;
      const cost = prevFret==null ? fret : Math.abs(fret-prevFret);
      if(best===null || cost<best.cost) best={s,fret,cost}; }
    if(best){ used.add(best.s); out.push({str:best.s+1,fret:best.fret}); }
  }
  return out;
}
const largestPow2 = n => { let p=16; while(p>n && p>1) p>>=1; return p; };   // largest valid note value (16ths) <= n, min 1 (never 0 -> no infinite loop)

// opts.rhythm: split durations into bar-aligned power-of-two pieces + ties (dotted lengths via tie, no dots).
// opts.voicing: fret each event near the previous one instead of always lowest.
function buildTex(notes, bpm, num, den, opts={}){
  const barSixteenths = num*(16/den), sixteenth = 60/bpm/4;
  // group near-simultaneous onsets into chord events (polyphonic engines); mono stays size-1 groups
  const win = Math.min(0.04, sixteenth*0.5);
  const events=[];
  for(const n of [...notes].sort((a,b)=>a.start-b.start)){ const e=events[events.length-1];
    if(e && Math.abs(n.start-e.start)<=win){ e.midis.push(Math.round(n.midi)); e.dur=Math.max(e.dur,n.dur); }
    else events.push({start:n.start, dur:n.dur, midis:[Math.round(n.midi)]}); }

  let out = `\\title "Whistle" \\tempo ${bpm} \\ts ${num} ${den} .`, inBar=0, prevEnd=0, prevFret=null;
  const add = tok => { out+=' '+tok; inBar+=tokSixteenths(tok);
    while(inBar>=barSixteenths){ out+=' |'; inBar-=barSixteenths; } };
  const beat = (fr, dtok, tie) => !fr.length ? `r.${dtok}`
    : fr.length>1 ? `(${fr.map(f=>`${tie?'-':f.fret}.${f.str}`).join(' ')}).${dtok}`
                  : `${tie?'-':fr[0].fret}.${fr[0].str}.${dtok}`;
  const emitTied = (fr, n) => { let rem=n, first=true;
    while(rem>0){ const v=largestPow2(Math.min(rem, barSixteenths-inBar)); add(beat(fr,durToken(v),!first)); rem-=v; first=false; } };
  const emitRest = n => { let rem=n; while(rem>0){ const v=largestPow2(Math.min(rem, barSixteenths-inBar)); add(`r.${durToken(v)}`); rem-=v; } };

  for(const e of events){
    const gap = toSixteenths(e.start-prevEnd,bpm);
    if(e.start-prevEnd > sixteenth*0.5) emitRest(gap);   // rests split freely (no ties needed), so always bar-align -> multi-bar gaps don't collapse to one whole rest
    const fr = chordFrets(e.midis, opts.voicing ? prevFret : null);
    const dur16 = toSixteenths(e.dur,bpm);
    opts.rhythm ? emitTied(fr, dur16) : add(beat(fr, durToken(dur16), false));
    if(fr.length) prevFret = Math.min(...fr.map(f=>f.fret));
    prevEnd = e.start + e.dur;
  }
  return out;
}

// alphaTab exports MIDI-only sounds; GP8 plays via RSE -> silent without a patch. Inject one. (patch from a known-good GP8 file)
function makeAudible(bytes){
  try{
    const files = unzipSync(bytes), key='Content/score.gpif';
    let g = strFromU8(files[key])
      .replace(/<\/MIDI>\s*<\/Sound>/g,'</MIDI><RSE><SoundbankPatch>D-Steel</SoundbankPatch><ElementsSettings></ElementsSettings></RSE></Sound>')
      .replace(/<AudioEngineState>MIDI<\/AudioEngineState>/g,'<AudioEngineState>RSE</AudioEngineState>');
    files[key]=strToU8(g);
    return zipSync(files);
  }catch(e){ console.warn('RSE inject failed, raw export:',e); return bytes; }
}

function buildScore(notes, bpm, num, den, opts){
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString(buildTex(notes,bpm,num,den,opts), new alphaTab.Settings());
  const score = imp.readScore();
  let ch=0;                         // program 25 = steel guitar; used by both export and the in-app player
  for(const t of score.tracks){ const pi=t.playbackInfo; if(!pi) continue;
    pi.program=25; pi.volume=16; pi.isMute=false; pi.isSolo=false;
    pi.primaryChannel=ch; pi.secondaryChannel=ch+1; ch+=2; pi.port=1; }
  return score;
}
const exportScore = score => makeAudible(new alphaTab.exporter.Gp7Exporter().export(score, new alphaTab.Settings()));

// per-input config: detection pitch range + whether pitch is reliable enough to transcribe absolute
const INSTR = {
  guitar:  {lo:75,  hi:1400, absolute:true,  start:40},   // low E; reliable pitch -> keep actual notes
  whistle: {lo:200, hi:4000, absolute:false, start:72},   // high register (C5); tuning unreliable -> anchor to start note
  humming: {lo:80,  hi:1000, absolute:false, start:48},   // low (C3)
  singing: {lo:80,  hi:1200, absolute:false, start:57},   // mid (A3)
};

// ---------- Basic Pitch (Spotify) — polyphonic neural transcription, loaded lazily (big) ----------
const BP_BASE='https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1';
let bpMod=null;
function resampleTo(data, sr, target){
  if(sr===target) return data;
  const ratio=target/sr, n=Math.floor(data.length*ratio), out=new Float32Array(n);
  for(let i=0;i<n;i++){ const pos=i/ratio, idx=Math.floor(pos), frac=pos-idx;
    const a=data[idx]||0, b=(data[idx+1]!==undefined?data[idx+1]:a); out[i]=a+(b-a)*frac; }
  return out;
}
async function basicPitchNotes(data, sr, onProg){
  bpMod = bpMod || await import(/* @vite-ignore */ `${BP_BASE}/+esm`);
  const bp = new bpMod.BasicPitch(`${BP_BASE}/model/model.json`);
  const audio = resampleTo(data, sr, 22050);
  const frames=[], onsets=[], contours=[];
  await bp.evaluateModel(audio,
    (f,o,c)=>{ frames.push(...f); onsets.push(...o); contours.push(...c); },
    p=>{ if(onProg) onProg(p); });
  const notes = bpMod.noteFramesToTime(
    bpMod.addPitchBendsToNoteEvents(contours,
      bpMod.outputToNotesPoly(frames, onsets, 0.5, 0.3, 5)));   // onset thr, frame thr, min frames
  return notes.map(n => ({ midiFloat:n.pitchMidi, start:n.startTimeSeconds, dur:n.durationSeconds, amp:n.amplitude }));
}

// Basic Pitch is polyphonic and also reports quieter overtone "ghosts" of each note.
// mono (voice, whistle): one note at a time -> drop the quieter of two notes overlapping by more than half the shorter;
//   a smaller (legato) overlap just ends the earlier note where the next one starts.
// guitar (may play chords): drop a quieter (< 0.85x) note an octave / 12th / two octaves above a note starting with it,
//   or a much quieter (< 0.6x) note on a higher harmonic (partials 2-10) of a note already sounding. Chord tones strummed
//   at similar volume survive; ghosts come in under.
const HARMONICS = [12,19,24,28,31,34,36,38,40];          // semitones above the fundamental, rounded
function cleanPoly(notes, mono){
  const amp = n => n.amp ?? 1, end = n => n.start+n.dur, keep=[];
  for(const n of [...notes].sort((a,b)=>amp(b)-amp(a))){
    const p = Math.round(n.midiFloat);
    const clash = keep.some(k => { const iv = p-Math.round(k.midiFloat);
      if(mono) return Math.min(end(n),end(k)) - Math.max(n.start,k.start) > 0.5*Math.min(n.dur,k.dur);
      return (Math.abs(n.start-k.start) < 0.05 && [12,19,24].includes(iv) && amp(n) < 0.85*amp(k))
          || (n.start >= k.start-0.05 && n.start < end(k) && amp(n) < 0.6*amp(k) && HARMONICS.includes(iv)); });
    if(!clash) keep.push(n);
  }
  keep.sort((a,b)=>a.start-b.start);
  if(mono) for(let i=0;i+1<keep.length;i++)
    if(end(keep[i]) > keep[i+1].start) keep[i] = {...keep[i], dur: keep[i+1].start-keep[i].start};
  return keep;
}

// ---------- detection: audio buffer + settings snapshot -> raw notes (pure; no DOM, no globals) ----------
async function detectNotes(audio, S, onProg){
  const data = audio.getChannelData(0), sr = audio.sampleRate;
  if(S.engine==='ai') return cleanPoly(await basicPitchNotes(data, sr, onProg), S.instrument!=='guitar');

  const c = INSTR[S.instrument] || INSTR.whistle;
  const size=2048, hop=512, det=PitchDetector.forFloat32Array(size), hopSec=hop/sr, frames=[];
  for(let i=0;i+size<=data.length;i+=hop){
    const [hz,clarity]=det.findPitch(data.subarray(i,i+size), sr);
    let s=0; const c0=i+(size-hop)/2; for(let j=c0;j<c0+hop;j++) s+=data[j]*data[j];   // short-window energy at frame centre
    frames.push({t:i/sr, e:Math.sqrt(s/hop), midi:(clarity>=S.clarity && hz>c.lo && hz<c.hi)?hzToMidi(hz):null});
  }
  // re-articulation: energy jumps >2x over the last ~35ms (a breath gap, a re-pluck). Starts a new note even at the
  // same pitch, and such a note is never merged back -- so "Hap-py" stays two notes. A detector dropout keeps energy up.
  let peak=1e-9; for(const f of frames) if(f.e>peak) peak=f.e;          // (no spread: long files exceed arg limits)
  const attack = k => k>=3 && frames[k].e > 0.05*peak && frames[k].e > 2*Math.min(frames[k-1].e, frames[k-2].e, frames[k-3].e);
  let lastAtk = -1e9;                // ~70ms hold-off: a gradual onset fires on several frames; only its first counts
  // pitch from the note's stable middle: skips the attack scoop (whistlers slide up into notes) and the release droop
  const stable = v => v.length>=6 ? median(v.slice(Math.floor(v.length/3), Math.ceil(v.length*0.9))) : median(v);
  const notes=[]; let cur=null;      // segment: runs within 0.6 semitone; break on silence, pitch jump or re-articulation
  const flush=()=>{ if(cur && (cur.end-cur.start)*1000>=S.minMs) notes.push({midiFloat:stable(cur.vals),start:cur.start,dur:cur.end-cur.start,atk:cur.atk}); cur=null; };
  frames.forEach((fr,k) => {
    if(fr.midi===null){ if(cur) flush(); return; }
    const atk = k-lastAtk > 6 && attack(k); if(atk) lastAtk=k;
    if(cur && !atk && Math.abs(fr.midi-cur.med)<0.6){ cur.vals.push(fr.midi); cur.end=fr.t+hopSec; cur.med=median(cur.vals); }
    else { if(cur) flush(); cur={start:fr.t,end:fr.t+hopSec,vals:[fr.midi],med:fr.midi,atk}; }
  });
  flush();
  const merged=[];                   // merge same-pitch splits across a tiny gap (detector dropouts), not re-articulations
  for(const n of notes){ const p=merged[merged.length-1];
    if(p && !n.atk && Math.round(p.midiFloat)===Math.round(n.midiFloat) && (n.start-(p.start+p.dur))*1000<=S.mergeMs) p.dur=n.start+n.dur-p.start;
    else merged.push({...n}); }
  return merged.map(({atk, ...n}) => n);
}

// ---------- latency calibration: record a few metronome beats, find how far onsets sit off the grid ----------
// Onsets (recorded clicks, or your taps) should land on beats; their shared phase vs the beat period is the system lag.
// Returns the timing offset in ms (negative = onsets arrive late, shift notes earlier to compensate), or null if no clear beat.
function estimateLag(data, sr, beatSec){
  const win=Math.max(1,Math.round(sr*0.01)), env=[];                       // 10ms RMS envelope
  for(let i=0;i+win<=data.length;i+=win){ let s=0; for(let j=0;j<win;j++){ const v=data[i+j]; s+=v*v; } env.push(Math.sqrt(s/win)); }
  const max=Math.max(...env); if(!(max>1e-4)) return null;
  const thr=max*0.3, onsets=[]; let last=-1;
  for(let k=1;k<env.length;k++){ const t=k*win/sr;                         // rising edge over threshold + 80ms refractory
    if(env[k]>thr && env[k-1]<=thr && (last<0||t-last>0.08)){ onsets.push(t); last=t; } }
  if(onsets.length<4) return null;
  let mx=0,my=0; for(const t of onsets){ const a=2*Math.PI*((t%beatSec)/beatSec); mx+=Math.cos(a); my+=Math.sin(a); }
  mx/=onsets.length; my/=onsets.length;
  if(Math.hypot(mx,my)<0.5) return null;                                   // onsets not clustered to one phase -> no clear beat
  let phi=Math.atan2(my,mx); if(phi<0)phi+=2*Math.PI;
  let dev=phi/(2*Math.PI)*beatSec;                                         // [0,beatSec): seconds after the beat line
  if(dev>beatSec/2) dev-=beatSec;                                          // fold to nearest grid line, [-beatSec/2, beatSec/2]
  return Math.max(-300, Math.min(300, Math.round(-dev*1000)));            // offset to compensate, clamped to the slider range
}

// the take's own tuning, in semitones [-0.5, 0.5]: duration-weighted circular mean of each note's offset from equal
// temperament. Whistlers often sit between semitones; rounding against this (not against one note) keeps intervals right.
function tuningOffset(raw){
  let x=0, y=0;
  for(const n of raw){ const a=2*Math.PI*(n.midiFloat-Math.round(n.midiFloat)), w=n.dur>0?n.dur:0; x+=w*Math.cos(a); y+=w*Math.sin(a); }
  return Math.atan2(y, x)/(2*Math.PI);
}
// absolute pitch of the first note, rounded the same tuning-aware way mapNotes rounds -- use as the anchor when the
// input's pitch is trusted (guitar, Basic Pitch), so a detuned take doesn't shift the whole tab a semitone
const firstMidi = raw => Math.round(raw[0].midiFloat - tuningOffset(raw));
// raw detected notes -> tab notes: first note pinned to anchorMidi, the rest keep their interval from it.
function mapNotes(raw, anchorMidi, offsetSec=0){
  if(!raw.length) return [];
  const tune=tuningOffset(raw), q=n=>Math.round(n.midiFloat-tune), q0=q(raw[0]);
  return raw.map(n => ({ midi: anchorMidi + q(n) - q0, start: Math.max(0, n.start + offsetSec), dur: n.dur }));
}

export { mapNotes, firstMidi, OPEN, NAMES, hzToMidi, midiToHz, noteName, median, midiToFret, toSixteenths, durToken, tokSixteenths, chordFrets, largestPow2, buildTex, makeAudible, buildScore, exportScore, INSTR, BP_BASE, resampleTo, basicPitchNotes, detectNotes, estimateLag };
