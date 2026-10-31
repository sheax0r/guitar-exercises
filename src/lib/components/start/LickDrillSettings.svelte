<script lang="ts">
  import { CHROMATIC, NOTE_DISPLAY, type Note } from '../../music/notes';
  import type { StringNum } from '../../music/tuning';
  import { noteName } from '../../transcribe/fretting';
  import { deleteLick, type SavedLick } from '../../storage/licks';
  import { ORDINAL } from '../../exercise/summary';
  import ChipGroup from './ChipGroup.svelte';
  import MicSettings from '../MicSettings.svelte';

  type Props = {
    licks: SavedLick[];                              // $bindable
    lickId: string | null;                           // $bindable
    target: Note | 'random' | 'same';                // $bindable
    startString: StringNum | 'random' | 'any';       // $bindable
    inputMode: 'click' | 'mic';                      // $bindable
    micSensitivity: number;                          // $bindable
    micDeviceId: string | null;                      // $bindable
    micDevices: Array<{ deviceId: string; label: string }>;
  };
  let {
    licks = $bindable(),
    lickId = $bindable(),
    target = $bindable(),
    startString = $bindable(),
    inputMode = $bindable(),
    micSensitivity = $bindable(),
    micDeviceId = $bindable(),
    micDevices
  }: Props = $props();

  function remove(id: string) {
    licks = deleteLick(id);
    if (lickId === id) lickId = licks[0]?.id ?? null;
  }
</script>

<div class="row">
  <span class="label">Lick</span>
  {#if licks.length === 0}
    <span class="hint">
      No saved licks yet. In <a href="#/ideate">Ideate</a>, record or upload a take, open the finished job and
      use <strong>Drill this in Learn</strong> to save a few of its notes as a lick.
    </span>
  {:else}
    <ul class="licks" aria-label="Saved licks">
      {#each licks as l (l.id)}
        <li>
          <button type="button" class="chip" class:chip-active={lickId === l.id} aria-pressed={lickId === l.id}
            onclick={() => (lickId = l.id)}>{l.name}</button>
          <span class="notes">{l.notes.map(noteName).join(' ')}</span>
          <button type="button" class="chip del" aria-label={`Delete ${l.name}`} title="Delete" onclick={() => remove(l.id)}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
<div class="row">
  <span class="label">Start on</span>
  <ChipGroup
    bind:value={target}
    label="Start on"
    options={[
      { value: 'same', label: 'Same key' },
      { value: 'random', label: 'Random key' },
      ...CHROMATIC.map(n => ({ value: n, label: NOTE_DISPLAY[n] }))
    ]}
  />
</div>
<div class="row">
  <span class="label">Start string</span>
  <ChipGroup
    bind:value={startString}
    label="Start string"
    options={[
      { value: 'any', label: 'Any' },
      { value: 'random', label: 'Random' },
      ...([6, 5, 4, 3, 2, 1] as StringNum[]).map(s => ({ value: s, label: ORDINAL[s] }))
    ]}
  />
</div>
<div class="row">
  <span class="label">Input</span>
  <ChipGroup
    bind:value={inputMode}
    label="Input"
    options={[
      { value: 'click', label: 'Click the notes' },
      { value: 'mic', label: 'Play (mic)' }
    ]}
  />
  {#if inputMode === 'mic'}
    <MicSettings bind:sensitivity={micSensitivity} bind:deviceId={micDeviceId} devices={micDevices} />
  {/if}
  <span class="hint">Notes are judged in order by pitch; any octave counts. Clicks must start on the asked string.</span>
</div>

<style>
  .licks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .licks li { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .notes { flex: 1; min-width: 0; font-size: 13px; opacity: 0.7; overflow-wrap: anywhere; }
  .del { flex: none; }
</style>
