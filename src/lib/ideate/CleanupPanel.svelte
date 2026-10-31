<script lang="ts">
  // A finished job: render + play the tab (alphaTab), tweak start note / octave / timing /
  // musical cleanup (re-renders instantly, saved back to the job), re-transcribe a region or
  // the whole take as a new job, download the .gp or the raw take.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { detectNotes } from '../transcribe/detect';
  import { noteName } from '../transcribe/fretting';
  import { loadAlphaTab, SOUNDFONT_URL } from '../transcribe/score';
  import { settings, ui, anchorFor, decode, enqueue, renderJob, saveJob, snapshotSettings, type Job } from './state.svelte';
  import WaveformSelect from './WaveformSelect.svelte';
  import { mapNotes } from '../transcribe/quantize';
  import { fitGuitar, MAX_LICK_NOTES } from '../exercise/lick/lick';
  import { saveLick } from '../storage/licks';
  import { updatePrefs } from '../storage/prefs';
  import { LEARN_HASH } from '../routing/hash';

  let { job }: { job: Job } = $props();

  // Drill in Learn: a run of this take's notes (as the tab shows them) saved as a lick.
  const allNotes = $derived(job.rawNotes ? mapNotes(job.rawNotes, job.anchor! + 12 * (job.octShift ?? 0)).map(n => n.midi) : []);
  let lickFrom = $state(1);
  let lickTo = $state(8);
  let lickName = $state(untrack(() => job.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 40)));
  const lickNotes = $derived.by(() => {
    const a = Math.max(1, Math.floor(lickFrom || 1));
    return allNotes.slice(a - 1, Math.min(Math.floor(lickTo || 0), a + MAX_LICK_NOTES - 1));
  });
  function drillLick() {
    const lick = saveLick(lickName, fitGuitar(lickNotes));
    updatePrefs({ exercise: 'lick-drill', lickId: lick.id });
    location.hash = LEARN_HASH;
  }

  const NOTES = Array.from({ length: 88 - 40 + 1 }, (_, i) => 40 + i); // E2..E6
  let tabEl: HTMLDivElement;
  let api: any = null; // alphaTab API (CDN global, untyped)
  let canPlay = $state(false);
  let playing = $state(false);
  let playMetro = $state(true);
  let tabError = $state('');
  let buffer = $state<AudioBuffer | null>(null);
  let alphaReady = $state(false);

  onMount(async () => {
    try {
      const alphaTab = await loadAlphaTab();
      api = new alphaTab.AlphaTabApi(tabEl, { player: { enablePlayer: true, soundFont: SOUNDFONT_URL } });
      api.playerReady.on(() => (canPlay = true));
      api.playerStateChanged?.on((e: { state: number }) => (playing = e?.state === 1));
      alphaReady = true;
    } catch (e) {
      console.warn('alphaTab failed:', e);
      tabError = 'Preview unavailable (alphaTab did not load).';
    }
  });
  onDestroy(() => api?.destroy?.());

  // Re-render whenever the job or one of its tweaks changes; persist the tweak.
  $effect(() => {
    void [job.anchor, job.octShift, job.offset, job.clean, job.rawNotes];
    if (!alphaReady || !job.rawNotes) return;
    untrack(() => {
      try {
        const score = renderJob(job);
        tabError = '';
        api.renderScore(score);
      } catch (e) {
        console.warn('tab render failed:', e);
        tabError = 'Preview unavailable; download still works.';
      }
      saveJob(job);
    });
  });

  $effect(() => {
    if (api && 'metronomeVolume' in api) api.metronomeVolume = playMetro ? settings.metroVol : 0;
  });

  // Waveform for region select: decode the take once per job.
  $effect(() => {
    const audio = job.audio;
    buffer = null;
    decode(audio).then(b => (buffer = b), e => console.warn('waveform decode failed:', e));
  });

  async function retranscribe(a: number, b: number) {
    if (!buffer) return;
    const sr = buffer.sampleRate, d = buffer.getChannelData(0);
    const i0 = Math.floor(a * d.length), i1 = Math.min(d.length, Math.max(i0 + Math.floor(sr * 0.1), Math.floor(b * d.length)));
    const slice = new AudioBuffer({ length: i1 - i0, sampleRate: sr, numberOfChannels: 1 });
    slice.copyToChannel(d.subarray(i0, i1), 0);
    ui.status = 're-transcribing selection…';
    try {
      const raw = await detectNotes(slice, job.settings, p => (ui.status = `transcribing… ${Math.round(p * 100)}%`));
      if (!raw.length) {
        ui.status = 'nothing detected in selection';
        return;
      }
      job.rawNotes = raw;
      job.anchor = anchorFor(raw, job.settings);
      ui.status = '';
    } catch (e) {
      console.warn('selection transcription failed:', e);
      ui.status = 'selection transcription failed';
    }
  }

  // Re-run this take through the CURRENT live settings as a new job (non-destructive A/B).
  function rerun() {
    const s = snapshotSettings();
    enqueue(job.audio, `${job.name} · ${s.engine}${s.sep ? ' ' + s.stem : ''}`);
    ui.status = 're-transcribing as a new job, see Jobs';
  }

  function download(blob: Blob, name: string) {
    const a = document.createElement('a');
    a.download = name;
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }
  const AUDIO_EXT = /\.(wav|flac|ogg|oga|m4a|mp3|webm|aiff?|aac)\b/i;
  function saveTake() {
    const t = job.audio.type || '', m = job.name.match(AUDIO_EXT); // an uploaded file's own extension wins (MIME may be empty)
    const ext = m ? m[1].toLowerCase() : /flac/.test(t) ? 'flac' : /wav/.test(t) ? 'wav' : /ogg/.test(t) ? 'ogg'
      : /mp4|m4a/.test(t) ? 'm4a' : /aac/.test(t) ? 'aac' : /mpeg|mp3/.test(t) ? 'mp3' : 'webm';
    download(job.audio, `${job.name.replace(AUDIO_EXT, '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '')}.${ext}`);
  }

  // Space plays/pauses the tab, except while recording or when a control wants the key.
  function onKey(e: KeyboardEvent) {
    if (e.code !== 'Space' || ui.recording || !api || !canPlay) return;
    const t = e.target as HTMLElement;
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return;
    e.preventDefault();
    api.playPause();
  }
</script>

<svelte:window onkeydown={onKey} />

<section class="panel" aria-label="Cleanup">
  <h2>Cleanup: {job.name}</h2>
  <p class="hint">Change the first note to re-align the whole line (relative pitch). Re-renders instantly, no re-recording.</p>

  <div class="grid">
    <label class="row">
      <span class="label">First note is actually</span>
      <select bind:value={job.anchor} aria-label="First note is actually">
        {#each NOTES as m}<option value={m}>{noteName(m)}</option>{/each}
      </select>
    </label>
    <div class="row">
      <span class="label">Octave shift</span>
      <div class="chips">
        <button type="button" class="chip" aria-label="Octave down" onclick={() => (job.octShift = (job.octShift ?? 0) - 1)}>–</button>
        <span aria-live="polite">{job.octShift ?? 0}</span>
        <button type="button" class="chip" aria-label="Octave up" onclick={() => (job.octShift = (job.octShift ?? 0) + 1)}>+</button>
      </div>
    </div>
  </div>

  <div class="row">
    <label class="label" for="offset">Timing offset (ms)</label>
    <div class="offset">
      <input id="offset" type="number" min="-300" max="300" step="5" bind:value={job.offset} aria-label="Timing offset in ms" />
      <input type="range" min="-300" max="300" step="5" bind:value={job.offset} aria-label="Timing offset dial" />
    </div>
    <span class="hint">Slide notes against the beat grid (mic/output latency).</span>
  </div>

  <label><input type="checkbox" bind:checked={job.clean} /> Musical cleanup: tie real durations + smart fretting</label>

  {#if buffer}<WaveformSelect {buffer} onTranscribe={retranscribe} />{/if}

  <div class="chips">
    <button type="button" class="chip" onclick={rerun}>↻ Re-transcribe as new job</button>
    <span class="hint">Same take, current engine / input / detection / separation settings; keeps both for A/B.</span>
  </div>

  <h2>Preview</h2>
  {#if tabError}<p class="hint">{tabError}</p>{/if}
  <div class="tab" bind:this={tabEl}></div>
  <div class="actions">
    <button type="button" class="primary" disabled={!canPlay} onclick={() => api?.playPause()}>{playing ? '⏸ Pause' : '▶ Play'}</button>
    <button type="button" class="primary" disabled={!job.gpBytes} onclick={() => download(new Blob([job.gpBytes as BlobPart]), 'whistle.gp')}>⬇ Download whistle.gp</button>
    <button type="button" class="chip" title="Save this take's raw audio (e.g. as a test fixture)" onclick={saveTake}>⬇ Save take</button>
  </div>
  <label><input type="checkbox" bind:checked={playMetro} /> Metronome during playback</label>

  <h2>Drill in Learn</h2>
  <p class="hint">Save a short run of these notes as a lick, then play it in other keys and positions in Learn (up to {MAX_LICK_NOTES} notes).</p>
  <div class="lick">
    <label>From note <input type="number" min="1" max={allNotes.length} bind:value={lickFrom} aria-label="First note of the lick" /></label>
    <label>to <input type="number" min="1" max={allNotes.length} bind:value={lickTo} aria-label="Last note of the lick" /></label>
    <label class="name">Name <input type="text" maxlength="40" bind:value={lickName} aria-label="Lick name" /></label>
  </div>
  <p class="hint" aria-live="polite">{lickNotes.length ? `${lickNotes.map(noteName).join(' ')} (${lickNotes.length} of ${allNotes.length} notes)` : 'Pick a note range.'}</p>
  <div class="actions">
    <button type="button" class="primary" disabled={!lickNotes.length} onclick={drillLick}>Drill this in Learn</button>
  </div>
</section>

<style>
  .panel { display: flex; flex-direction: column; gap: 14px; border-top: 1px solid #888; padding-top: 18px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.7; margin: 0; overflow-wrap: anywhere; }
  .hint { margin: 0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  select { padding: 6px; max-width: 100%; }
  .offset { display: flex; gap: 10px; align-items: center; }
  .offset input[type='number'] { width: 80px; padding: 4px; }
  .offset input[type='range'] { flex: 1; min-width: 0; }
  .tab { background: #fff; color: #1a1a1a; border: 1px solid #888; border-radius: 8px; padding: 6px; overflow: auto; max-height: 340px; min-height: 80px; }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .primary { padding: 10px 18px; font-size: 15px; font-weight: 700; border: none; border-radius: 8px; background: #ff8c42; color: #1a1a1a; cursor: pointer; }
  .primary:disabled { opacity: 0.5; cursor: default; }
  .lick { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .lick input[type='number'] { width: 64px; padding: 4px; }
  .lick .name { flex: 1; display: flex; gap: 6px; align-items: center; min-width: 0; }
  .lick .name input { flex: 1; min-width: 0; padding: 4px; }
</style>
