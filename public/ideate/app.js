import { PitchDetector } from 'https://cdn.jsdelivr.net/npm/pitchy@4.1.0/+esm';
import { mapNotes, firstMidi, hzToMidi, midiToHz, noteName, midiToFret, toSixteenths, durToken, chordFrets, buildTex, buildScore, exportScore, INSTR, resampleTo, detectNotes, estimateLag } from './core.js';

const $ = id => document.getElementById(id);


// ---------- note dropdowns ----------
function fillNotes(sel, from, to, def){
  for(let m=from;m<=to;m++){ const o=document.createElement('option');
    o.value=m; o.textContent=`${noteName(m)}`; if(m===def) o.selected=true; sel.appendChild(o); }
}
fillNotes($('startNote'), 40, 72, 40);   // E2..C5, default low E
fillNotes($('anchor'),    40, 88, 57);   // E2..E6 (covers guitar range)

const cfg = () => INSTR[$('instrument').value] || INSTR.whistle;
const engine = () => $('engine').value;
$('engine').onchange = () => { $('engineHint').textContent =
  engine()==='ai' ? 'neural net · chords · ~1MB first load' : 'single-note pitch tracker'; };

// snap default: off when the input's pitch is reliable (guitar), on when register/tuning needs anchoring
const syncSnapDefault = () => { $('snap').checked = !cfg().absolute; };
const syncStartNote = () => { $('startNote').value = cfg().start; };
$('instrument').onchange = () => {
  $('instrHint').textContent = $('instrument').value==='guitar' ? 'single notes only' : 'monophonic';
  syncSnapDefault(); syncStartNote();
};
syncSnapDefault(); syncStartNote();

// ---------- input device picker (labels appear only after mic permission is granted once) ----------
async function populateDevices(){
  try{
    const ins = (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
    const sel=$('device'), prev=sel.value; sel.innerHTML='';
    const def=document.createElement('option'); def.value=''; def.textContent='Default input'; sel.appendChild(def);
    ins.forEach((d,i)=>{ const o=document.createElement('option');
      o.value=d.deviceId; o.textContent=d.label||`Microphone ${i+1}`; sel.appendChild(o); });
    if(prev) sel.value=prev;
  }catch(e){ console.warn('enumerateDevices failed:',e); }
}
populateDevices();
navigator.mediaDevices.addEventListener && navigator.mediaDevices.addEventListener('devicechange', populateDevices);

// tempo dial <-> number sync
$('bpmDial').oninput = () => $('bpm').value = $('bpmDial').value;
$('bpm').oninput     = () => $('bpmDial').value = $('bpm').value;

// ---------- metronome ----------
let ac, metroTimer;
const metroVol = () => +$('metrovol').value;   // 0..1, shared by record clicks + playback metronome
function click(time, accent){
  const o=ac.createOscillator(), g=ac.createGain();
  o.frequency.value = accent?1600:1000;
  g.gain.setValueAtTime(0.0001,time);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.6*metroVol()),time+0.001);
  g.gain.exponentialRampToValueAtTime(0.0001,time+0.05);
  o.connect(g).connect(ac.destination); o.start(time); o.stop(time+0.06);
}
function tone(time, midi, dur){          // sustained reference pitch held across the whole count-in
  const o=ac.createOscillator(), g=ac.createGain();
  o.type='sine'; o.frequency.value=midiToHz(midi);
  g.gain.setValueAtTime(0.0001,time);
  g.gain.exponentialRampToValueAtTime(0.35,time+0.03);     // ramp in
  g.gain.setValueAtTime(0.35,Math.max(time+0.04,time+dur-0.1));
  g.gain.exponentialRampToValueAtTime(0.0001,time+dur);    // ramp out at the end
  o.connect(g).connect(ac.destination); o.start(time); o.stop(time+dur+0.02);
}
const stopMetro = () => { if(metroTimer){ clearInterval(metroTimer); metroTimer=null; } };

// ---------- level meter + live tuner ----------
let meterRAF;
function startMeter(stream){
  const src=ac.createMediaStreamSource(stream), an=ac.createAnalyser();
  an.fftSize=2048; src.connect(an);
  const buf=new Float32Array(an.fftSize), det=PitchDetector.forFloat32Array(an.fftSize);
  const loop=()=>{ an.getFloatTimeDomainData(buf);
    let s=0; for(const x of buf) s+=x*x;
    $('meterbar').style.width = Math.min(100, Math.sqrt(s/buf.length)*300)+'%';
    const [hz,clar]=det.findPitch(buf, ac.sampleRate);
    const c=cfg(), tuner=$('tuner');
    if(clar>0.9 && hz>c.lo && hz<c.hi){
      const m=hzToMidi(hz), cents=Math.round((m-Math.round(m))*100);
      $('tnote').textContent=noteName(Math.round(m));
      $('tcents').textContent=(cents>0?'+':'')+cents+'¢';
      tuner.className = Math.abs(cents)<=15 ? 'intune' : 'off';
    } else { $('tnote').textContent='–'; $('tcents').textContent=''; tuner.className=''; }
    meterRAF=requestAnimationFrame(loop); };
  loop();
}
const stopMeter = () => { if(meterRAF) cancelAnimationFrame(meterRAF); meterRAF=null;
  $('meterbar').style.width='0'; $('tnote').textContent='–'; $('tcents').textContent=''; $('tuner').className=''; };

// ---------- record flow ----------
let media, chunks=[], recording=false;
$('rec').onclick = async () => {
  if(recording){ recording=false;
    const wasRec = media && media.state==='recording';
    if(wasRec) media.stop();                                                         // fires onstop -> enqueue + release mic
    else if(media && media.stream) media.stream.getTracks().forEach(t=>t.stop());    // stopped during count-in: recorder never started, just release the mic
    stopMetro(); stopMeter();
    $('rec').textContent='● REC'; $('rec').classList.remove('on');
    $('status').textContent = wasRec ? 'queued — see Jobs ▸' : 'cancelled'; return; }

  const dev = $('device').value;
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({audio: dev?{deviceId:{exact:dev}}:true}); }
  catch(err){ $('status').textContent='mic unavailable: '+(err.name||err); return; }
  populateDevices();                 // labels available now that permission is granted
  media = new MediaRecorder(stream); chunks=[];
  media.ondataavailable = e => chunks.push(e.data);
  media.onstop = () => { stream.getTracks().forEach(t=>t.stop());
    enqueue(new Blob(chunks,{type:media.mimeType||'audio/webm'}), 'Recording '+new Date().toLocaleTimeString()); };
  recording=true; $('rec').textContent='■ STOP'; $('rec').classList.add('on');

  ac = ac || new AudioContext(); await ac.resume();
  startMeter(stream);

  const bpm=+$('bpm').value, num=+$('num').value, den=+$('den').value;
  const beatSec=(60/bpm)*(4/den);
  const startRec = () => { if(recording){ media.start(); $('flash').style.display='none'; $('status').textContent='recording… whistle!'; } };

  const countBeats = $('countin').checked ? num : 0;
  const startMidi = +$('startNote').value;
  let next = ac.currentTime + 0.2, beat = 0;
  const recAt = next + countBeats*beatSec;
  setTimeout(startRec, Math.max(0,(recAt-ac.currentTime)*1000));
  $('status').textContent = countBeats ? 'count-in…' : 'recording…';

  if(countBeats && $('playpitch').checked) tone(next, startMidi, countBeats*beatSec);  // one sustained reference across count-in

  metroTimer = setInterval(()=>{
    while(next < ac.currentTime + 0.1){
      const inCount = beat < countBeats, accent = beat%num===0;
      if($('metro').checked || inCount) click(next, accent);
      if(inCount){ const n=beat+1, when=(next-ac.currentTime)*1000;      // flash the count number
        setTimeout(()=>{ $('flash').style.display='flex'; $('flash').textContent=n; }, Math.max(0,when)); }
      next += beatSec; beat++;
    }
  },25);
};

// ---------- file upload: enqueue an existing clip (no mic, no count-in) ----------
$('file').onchange = e => {
  const f = e.target.files[0]; if(!f) return;
  enqueue(f, f.name);
  $('status').textContent='queued — see Jobs ▸';
  e.target.value='';   // allow re-selecting the same file
};

// ---------- source separation (demucs-web via onnxruntime-web), lazy + single-threaded ----------
// single-thread avoids SharedArrayBuffer, so no cross-origin-isolation (COOP/COEP) headers needed -> stays frontend-only.
const ORT_VER='1.20.1';
let ortMod=null, demucsMod=null, demucsProc=null, sepProgCb=null;
async function separate(audio, stem, onProg){
  sepProgCb = onProg;
  ortMod = ortMod || await import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/+esm`);
  ortMod.env.wasm.numThreads = 1;
  ortMod.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
  demucsMod = demucsMod || await import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/demucs-web@1.0.2/+esm`);
  if(!demucsProc){
    const proc = new demucsMod.DemucsProcessor({ ort:ortMod,
      onDownloadProgress:(l,t)=>{ if(sepProgCb&&t) sepProgCb(0.4*l/t); },          // 0..0.4 = model download
      onProgress:({progress})=>{ if(sepProgCb) sepProgCb(0.4+0.6*(progress||0)); } }); // 0.4..1 = separation
    await proc.loadModel(demucsMod.CONSTANTS.DEFAULT_MODEL_URL);                   // assign only after load resolves, so a failed download can be retried
    demucsProc = proc;
  }
  const sr=44100;
  let L=audio.getChannelData(0), R=audio.numberOfChannels>1?audio.getChannelData(1):null;
  if(audio.sampleRate!==sr){ L=resampleTo(L,audio.sampleRate,sr); R=R?resampleTo(R,audio.sampleRate,sr):null; }
  R=R||L;
  const res = await demucsProc.separate(L, R);
  const s = res[stem] || res.other;
  const mono = new Float32Array(s.left.length);
  for(let i=0;i<mono.length;i++) mono[i]=(s.left[i]+(s.right?s.right[i]:s.left[i]))/2;
  const out=(ac||new AudioContext()).createBuffer(1, mono.length, sr); out.copyToChannel(mono,0);
  return out;
}


// ---------- render queue: each job owns its audio, settings, notes + result. Serial. Persisted in IndexedDB. ----------
const DB_NAME='whistler', STORE='jobs';
function idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function idbPut(j){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(j); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }
async function idbAll(){ const db=await idb(); return new Promise((res,rej)=>{ const rq=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
  rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>rej(rq.error); }); }
async function idbDel(id){ const db=await idb(); return new Promise((res)=>{ const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).delete(id); tx.oncomplete=res; }); }

// persist everything except the live alphaTab score object (rebuilt on open)
const persist = j => idbPut({id:j.id,name:j.name,createdAt:j.createdAt,status:j.status,settings:j.settings,
  audio:j.audio, rawNotes:j.rawNotes, gpBytes:j.gpBytes, anchor:j.anchor, octShift:j.octShift, offset:j.offset, clean:j.clean, error:j.error}).catch(e=>console.warn('persist',e));

let jobs=[], pumping=false;
let calibMs = Math.round(+localStorage.getItem('whistler.calib')) || 0;   // calibrated mic/output latency -> default timing offset for new jobs
const snapshotSettings = () => ({ engine:engine(), bpm:+$('bpm').value, num:+$('num').value, den:+$('den').value,
  instrument:$('instrument').value, snap:$('snap').checked, startNote:+$('startNote').value,
  clarity:+$('clarity').value, minMs:+$('minms').value, mergeMs:+$('mergems').value, cleanup:false,   // new jobs start with cleanup off; it's a per-job tweak in the panel (not the open job's checkbox)
  sep:$('sep').checked, stem:$('stem').value });
$('sep').onchange = () => { $('stem').disabled = !$('sep').checked; };

async function enqueue(blob, name){
  const job={ id:crypto.randomUUID(), name, createdAt:Date.now(), status:'queued', settings:snapshotSettings(), audio:blob };
  jobs.push(job); await persist(job); renderQueue(); openDrawer(); pump();
}
async function pump(){
  if(pumping) return;
  const job=jobs.find(j=>j.status==='queued'); if(!job) return;
  pumping=true; job.status='rendering'; job.progress=0; renderQueue();
  try{
    let audio=await (ac||new AudioContext()).decodeAudioData(await job.audio.arrayBuffer());
    if(job.settings.sep){ job.phase='separating'; job.progress=0; renderQueue();
      audio = await separate(audio, job.settings.stem, p=>{ job.progress=p; renderQueue(); });
      if(job.status==='cancelled'){ await persist(job); pumping=false; return pump(); } }
    job.phase='transcribing';
    const raw=await detectNotes(audio, job.settings, p=>{ job.progress=p; renderQueue(); });
    if(job.status==='cancelled'){ await persist(job); }           // user bailed mid-render; keep cancelled
    else if(!raw.length){ job.status='error'; job.error='nothing detected'; await persist(job); }
    else {
      job.rawNotes=raw;
      const first=firstMidi(raw), S=job.settings;
      const useSnap = S.engine==='pitchy' && S.snap;             // pitchy+snap -> relative to start note; else absolute
      job.anchor = useSnap ? S.startNote : Math.max(40,Math.min(88,first));
      job.octShift=0; job.offset=calibMs; job.clean=S.cleanup;   // start from the calibrated latency offset
      renderJob(job, false);                                     // build gpBytes headless
      job.status='done'; await persist(job);
    }
  }catch(e){ console.warn('job failed:',e); job.status='error'; job.error=String(e); await persist(job); }
  renderQueue(); pumping=false; pump();                          // next queued
}
function cancelJob(id){ const j=jobs.find(x=>x.id===id); if(!j) return;
  if(j.status==='queued'||j.status==='rendering'){ j.status='cancelled'; persist(j); renderQueue(); } }
async function removeJob(id){ jobs=jobs.filter(j=>j.id!==id); await idbDel(id);
  if(current && current.id===id){ current=null; $('cleanup').style.display='none'; } renderQueue(); }

// ---------- drawer ----------
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STLABEL={queued:'queued',rendering:'rendering',done:'ready',error:'failed',cancelled:'cancelled'};
function renderQueue(){
  const ul=$('qlist'); if(!ul) return; ul.innerHTML='';
  const active=jobs.filter(j=>j.status==='queued'||j.status==='rendering').length;
  $('qcount').textContent = active ? active : '';
  $('qcount').style.display = active ? 'inline-block' : 'none';
  if(!jobs.length){ ul.innerHTML='<li class="qempty">no jobs yet — record or upload a file</li>'; return; }
  [...jobs].reverse().forEach(j=>{
    const li=document.createElement('li'); li.className='qitem s-'+j.status + (current&&current.id===j.id?' cur':'');
    const prog = j.status==='rendering' && j.progress ? ` · ${Math.round(j.progress*100)}%` : '';
    const st = j.status==='rendering' && j.phase ? j.phase : (STLABEL[j.status]||j.status);
    const tag = j.settings.engine + (j.settings.sep?' · sep':'');
    li.innerHTML = `<div class="qname">${esc(j.name)}</div><div class="qmeta">${tag}${prog} · <span class="qst">${st}</span></div>`;
    if(j.status==='done'){ li.classList.add('clk'); li.onclick=()=>openJob(j); }
    if(j.status==='error' && j.error){ li.title=j.error; }
    const b=document.createElement('button'); b.className='qbtn';
    const active=(j.status==='queued'||j.status==='rendering');
    b.textContent = active ? 'Cancel' : '✕';
    b.onclick = ev => { ev.stopPropagation(); active ? cancelJob(j.id) : removeJob(j.id); };
    li.appendChild(b); ul.appendChild(li);
  });
}
const openDrawer  = () => $('queue').classList.remove('collapsed');
const toggleDrawer= () => $('queue').classList.toggle('collapsed');
$('qtoggle').onclick=toggleDrawer; $('qclose').onclick=()=>$('queue').classList.add('collapsed');

// load persisted jobs on startup; demote anything left mid-render (reload interrupted it)
(async()=>{ try{ jobs=(await idbAll()).sort((a,b)=>a.createdAt-b.createdAt);
  jobs.forEach(j=>{ if(j.status==='rendering') j.status='queued'; }); renderQueue(); pump(); }
  catch(e){ console.warn('queue load failed:',e); } })();

// ---------- alphaTab player (renders + plays the tab in-browser; own soundfont, independent of GP) ----------
const SF_URL='https://cdn.jsdelivr.net/npm/@coderline/alphatab@1.8.4/dist/soundfont/sonivox.sf2';
let atApi=null;
function ensureApi(){
  if(atApi) return atApi;
  atApi = new alphaTab.AlphaTabApi($('tab'), { player:{ enablePlayer:true, soundFont:SF_URL } });
  atApi.playerReady.on(()=>{ $('play').disabled=false; });
  atApi.playerStateChanged && atApi.playerStateChanged.on(e=>{
    $('play').textContent = (e && e.state===1) ? '⏸ Pause' : '▶ Play'; });
  applyPlayMetro();
  return atApi;
}
const applyPlayMetro = () => { if(atApi && 'metronomeVolume' in atApi) atApi.metronomeVolume = $('playmetro').checked ? metroVol() : 0; };
$('playmetro').onchange = applyPlayMetro;
$('metrovol').oninput = applyPlayMetro;   // live-update playback; record clicks read metroVol() per click
$('play').onclick = () => atApi && atApi.playPause();

// Space plays/pauses the tab once one exists — don't let it re-trigger the focused REC button.
document.addEventListener('keydown', e => {
  if(e.code!=='Space' || recording) return;
  const t=e.target;
  if(t===$('play') || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;  // let these handle Space normally
  if(atApi && !$('play').disabled){ e.preventDefault(); atApi.playPause(); }
});

// ---------- render a job: map raw notes -> anchor via relative intervals, build tab + .gp ----------
let octShift = 0, gpBytes = null, current = null;

const jobNotes = job => mapNotes(job.rawNotes, job.anchor + 12*job.octShift, job.offset/1000);   // offset absorbs mic/output latency
// build score + gpBytes for a job; draw=true also paints the alphaTab preview + arms download
function renderJob(job, draw){
  const {bpm,num,den}=job.settings;
  const score = buildScore(jobNotes(job), bpm, num, den, {rhythm:job.clean, voicing:job.clean});
  job.gpBytes = exportScore(score);
  if(draw){ gpBytes = job.gpBytes;
    try{ ensureApi().renderScore(score); }
    catch(e){ console.warn('tab render failed:',e); $('tab').textContent='(preview unavailable — download still works)'; } }
  return score;
}
// load a finished job into the cleanup/preview panel (play, download, interactive tweaks)
async function openJob(job){
  if(job.status!=='done') return;
  current=job; octShift=job.octShift; $('octVal').textContent=octShift;
  $('anchor').value=job.anchor; $('offset').value=job.offset; $('offsetDial').value=job.offset; $('cleanup2').checked=job.clean;
  $('cleanup').style.display='block';
  renderJob(job, true); renderQueue();
  try{ if(!job._buf) job._buf = await (ac||new AudioContext()).decodeAudioData(await job.audio.arrayBuffer());
    selA=0; selB=1; $('wavewrap').style.display='block'; drawWave();
  }catch(e){ console.warn('waveform decode failed:',e); $('wavewrap').style.display='none'; }
  $('cleanup').scrollIntoView({behavior:'smooth',block:'nearest'});
}

// ---------- waveform + region select (re-transcribe a slice of the open job) ----------
let selA=0, selB=1;
function drawWave(){
  const c=$('wave'), buf=current && current._buf; if(!buf) return;
  const w=c.width=c.clientWidth||600, h=c.height, ctx=c.getContext('2d'), d=buf.getChannelData(0);
  const step=Math.max(1,Math.floor(d.length/w)), mid=h/2;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(238,34,51,0.18)'; ctx.fillRect(selA*w,0,(selB-selA)*w,h);   // selection shade
  ctx.strokeStyle=getComputedStyle(document.body).color; ctx.globalAlpha=0.65; ctx.beginPath();
  for(let x=0;x<w;x++){ let min=1,max=-1; for(let i=0;i<step;i++){ const v=d[x*step+i]||0; if(v<min)min=v; if(v>max)max=v; }
    ctx.moveTo(x+0.5,mid+min*mid); ctx.lineTo(x+0.5,mid+max*mid); }
  ctx.stroke(); ctx.globalAlpha=1;
  $('wsel').textContent = (selA>0||selB<1) ? `${(selA*buf.duration).toFixed(2)}–${(selB*buf.duration).toFixed(2)}s` : `full clip (${buf.duration.toFixed(2)}s)`;
}
(function(){ const c=$('wave'); let dragging=false, x0=0;
  const frac=e=>{ const r=c.getBoundingClientRect(); return Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)); };
  c.addEventListener('pointerdown',e=>{ if(!current||!current._buf) return; dragging=true; x0=frac(e); selA=selB=x0; c.setPointerCapture(e.pointerId); drawWave(); });
  c.addEventListener('pointermove',e=>{ if(!dragging) return; const x=frac(e); selA=Math.min(x0,x); selB=Math.max(x0,x); drawWave(); });
  c.addEventListener('pointerup',()=>{ if(!dragging) return; dragging=false; if(selB-selA<0.004){ selA=0; selB=1; drawWave(); } });
})();
window.addEventListener('resize', ()=>{ if(current&&current._buf&&$('wavewrap').style.display!=='none') drawWave(); });

async function retranscribe(){
  if(!current||!current._buf) return;
  const buf=current._buf, sr=buf.sampleRate, d=buf.getChannelData(0);
  const i0=Math.floor(selA*d.length), i1=Math.min(d.length, Math.max(i0+Math.floor(sr*0.1), Math.floor(selB*d.length)));
  const slice=(ac||new AudioContext()).createBuffer(1, i1-i0, sr); slice.copyToChannel(d.subarray(i0,i1),0);
  $('status').textContent='re-transcribing selection…';
  try{
    const raw=await detectNotes(slice, current.settings, p=>$('status').textContent=`transcribing… ${Math.round(p*100)}%`);
    if(!raw.length){ $('status').textContent='nothing detected in selection'; return; }
    current.rawNotes=raw;
    const S=current.settings, first=firstMidi(raw);
    current.anchor = (S.engine==='pitchy'&&S.snap) ? S.startNote : Math.max(40,Math.min(88,first));
    $('anchor').value=current.anchor;
    renderJob(current,true); persist(current); $('status').textContent='';
  }catch(e){ console.warn('selection transcription failed:',e); $('status').textContent='selection transcription failed'; }
}
$('retr').onclick = retranscribe;
$('wfull').onclick = () => { selA=0; selB=1; drawWave(); retranscribe(); };
// re-render the open job after a cleanup tweak, persist the change
function render(){
  if(!current) return;
  current.anchor=+$('anchor').value; current.octShift=octShift; current.offset=+$('offset').value; current.clean=$('cleanup2').checked;
  renderJob(current, true); persist(current);
}
$('anchor').onchange = render;
$('octUp').onclick   = () => { octShift++; $('octVal').textContent=octShift; render(); };
$('octDown').onclick = () => { octShift--; $('octVal').textContent=octShift; render(); };
$('offsetDial').oninput = () => { $('offset').value=$('offsetDial').value; render(); };
$('offset').oninput     = () => { $('offsetDial').value=$('offset').value; render(); };
$('cleanup2').onchange  = render;

// re-run the open take through the CURRENT live settings as a fresh job (non-destructive A/B vs the original)
$('rerun').onclick = () => {
  if(!current||!current.audio) return;
  const s=snapshotSettings();
  enqueue(current.audio, `${current.name} · ${s.engine}${s.sep?' '+s.stem:''}`);
  $('status').textContent='re-transcribing as new job — see Jobs ▸';
};


let calibrating=false;
async function calibrate(){
  if(recording||calibrating) return;
  const bpm=+$('bpm').value, den=+$('den').value, num=+$('num').value||4, beatSec=(60/bpm)*(4/den), beats=8;
  const tap=$('calibmode').value==='tap';
  let stream;
  try{ const dev=$('device').value; stream=await navigator.mediaDevices.getUserMedia({audio: dev?{deviceId:{exact:dev}}:true}); }
  catch(err){ $('calibout').textContent='mic unavailable: '+(err.name||err); return; }
  calibrating=true; $('calib').disabled=true;
  $('calibout').textContent = tap ? 'tap each beat…' : 'listening to clicks…';
  ac = ac || new AudioContext(); await ac.resume();
  const rec=new MediaRecorder(stream), cks=[];
  rec.ondataavailable=e=>cks.push(e.data);
  const done=new Promise(res=>{ rec.onstop=()=>{ stream.getTracks().forEach(t=>t.stop()); res(new Blob(cks,{type:rec.mimeType||'audio/webm'})); }; });
  rec.start();
  const t0=ac.currentTime+0.25;
  for(let k=0;k<beats;k++){ click(t0+k*beatSec, k%num===0);                // audible beat (tapper follows it; clicks-mode records it)
    const when=(t0+k*beatSec-ac.currentTime)*1000;
    setTimeout(()=>{ $('flash').style.display='flex'; $('flash').textContent=k+1; setTimeout(()=>$('flash').style.display='none',120); }, Math.max(0,when)); }
  setTimeout(()=>{ try{rec.stop();}catch{} }, (t0+beats*beatSec-ac.currentTime)*1000 + 300);
  const blob=await done;
  calibrating=false; $('calib').disabled=false; $('flash').style.display='none';
  try{
    const buf=await ac.decodeAudioData(await blob.arrayBuffer());
    const offMs=estimateLag(buf.getChannelData(0), buf.sampleRate, beatSec);
    if(offMs==null){ $('calibout').textContent = tap ? 'no clear beat — tap on each click' : 'no clear beat — turn clicks up'; return; }
    calibMs=offMs; try{ localStorage.setItem('whistler.calib',String(offMs)); }catch{}
    $('offset').value=offMs; $('offsetDial').value=offMs;
    if(current){ current.offset=offMs; render(); }                        // apply to the open job immediately
    $('calibout').textContent=`calibrated: offset ${offMs>=0?'+':''}${offMs} ms (applied + saved as default)`;
  }catch(e){ console.warn('calibration analysis failed:',e); $('calibout').textContent='analysis failed'; }
}
$('calib').onclick = calibrate;

// save the open take's raw audio (recorded or uploaded), e.g. to drop into test/fixtures/
const AUDIO_EXT=/\.(wav|flac|ogg|oga|m4a|mp3|webm|aiff?|aac)\b/i;
const download = (blob, name) => { const a=document.createElement('a'); a.download=name; a.href=URL.createObjectURL(blob);
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 0); };
$('savetake').onclick = () => {
  if(!current||!current.audio) return;
  const t=current.audio.type||'', m=current.name.match(AUDIO_EXT);   // an uploaded file's own extension wins (MIME may be empty)
  const ext = m ? m[1].toLowerCase() : /flac/.test(t)?'flac' : /wav/.test(t)?'wav' : /ogg/.test(t)?'ogg'
            : /mp4|m4a/.test(t)?'m4a' : /aac/.test(t)?'aac' : /mpeg|mp3/.test(t)?'mp3' : 'webm';
  download(current.audio, `${current.name.replace(AUDIO_EXT,'').replace(/[^\w.-]+/g,'_').replace(/^_+|_+$/g,'')}.${ext}`);
};

$('dl').onclick = () => {
  if(!gpBytes) return;
  download(new Blob([gpBytes]), 'whistle.gp');
};

// ---------- self-test (ponytail: one runnable check for the pure logic) ----------
(function(){
  const r=[], eq=(x,y,m)=>r.push((JSON.stringify(x)===JSON.stringify(y)?'ok ':'BAD ')+m);
  eq(midiToFret(64),{str:1,fret:0},'high E open');
  eq(midiToFret(40),{str:6,fret:0},'low E open');
  eq(midiToFret(60),{str:2,fret:1},'C4 -> B string f1');
  eq(toSixteenths(60/120,120),4,'1 beat @120 = 4 sixteenths');
  eq(durToken(4),'4','quarter'); eq(durToken(1),'16','sixteenth');
  eq(noteName(57),'A3','midi 57 = A3'); eq(noteName(88),'E6','midi 88 = E6');
  // relative anchor: first note = chosen, intervals preserved (mapNotes, as the tab uses it)
  const raw=[{midiFloat:88.1,dur:.5},{midiFloat:90.0,dur:.5},{midiFloat:85.2,dur:.5}];
  eq(mapNotes(raw,57).map(n=>n.midi),[57,59,54],'relative map: +2, -3 semitones from anchor');
  // detuned take (~40c flat) with a scooped first note: round against the take's tuning, not the first note
  const flat=[{midiFloat:59.45,dur:.1},{midiFloat:61.6,dur:.5},{midiFloat:63.6,dur:.5},{midiFloat:59.6,dur:.5}];
  eq(firstMidi(flat),60,'tuning-aware anchor: scooped flat C4 -> 60');
  eq(mapNotes(flat,firstMidi(flat)).map(n=>n.midi),[60,62,64,60],'tuning-aware intervals: C D E C');
  // chord grouping (polyphonic engine): same onset -> one chord token; different onset -> separate
  eq(/\(\S+ \S+\)\./.test(buildTex([{midi:40,start:0,dur:.5},{midi:47,start:0,dur:.5}],120,4,4)),true,'simultaneous -> chord');
  eq(/\(/.test(buildTex([{midi:40,start:0,dur:.5},{midi:47,start:.5,dur:.5}],120,4,4)),false,'sequential -> no chord');
  // voicing: null = greedy lowest; prevFret biases to nearest position
  eq(chordFrets([62])[0].fret,3,'greedy lowest fret (D4 -> B str f3)');
  eq(chordFrets([62],10)[0].fret,12,'voicing: nearest to prevFret 10 -> D str f12');
  // rhythm: 6 sixteenths (dotted-quarter length) -> quarter tied to eighth (dash present)
  eq(/-/.test(buildTex([{midi:40,start:0,dur:0.75}],120,4,4,{rhythm:true})),true,'rhythm: 6/16 -> tie');
  eq(/-/.test(buildTex([{midi:40,start:0,dur:0.75}],120,4,4)),false,'no-rhythm: single base value, no tie');
  // latency estimate: synthetic onsets 40ms after each beat line -> offset ~ -40ms (shift earlier)
  (()=>{ const sr=1000, beatSec=0.5, d=new Float32Array(2200);
    for(const t of [0.04,0.54,1.04,1.54,2.04]) for(let j=0;j<4;j++) d[Math.round(t*sr)+j]=1;
    const off=estimateLag(d,sr,beatSec);
    r.push((off!=null && Math.abs(off+40)<=15 ? 'ok ' : 'BAD ')+`estimateLag: 40ms-late onsets -> ${off}ms (expect ~ -40)`); })();
  const bad=r.filter(x=>x.startsWith('BAD'));
  $('selftest').innerHTML = bad.length?'<span class="bad">selftest: '+bad.join('; ')+'</span>':'<span class="ok">selftest ok</span>';
})();
