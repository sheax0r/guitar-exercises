<script lang="ts">
  import type { Note } from '../../music/notes';
  import { MODE_ORDER, MODE_DISPLAY, type Mode } from '../../music/modes';
  import ChipGroup from './ChipGroup.svelte';
  import NotePicker from './NotePicker.svelte';
  import MicSettings from '../MicSettings.svelte';

  type Props = {
    exercise: 'play-shape' | 'identify-mode';
    enabledModes: Mode[];               // $bindable
    shapeVariant: 'octave' | 'box';     // $bindable
    octaveJudge: 'pitch' | 'fixed';     // $bindable
    boxSpan: number;                    // $bindable
    inputMode: 'click' | 'mic';         // $bindable
    micSensitivity: number;             // $bindable
    micDeviceId: string | null;         // $bindable
    micDevices: Array<{ deviceId: string; label: string }>;
    identifyPromptMode: 'visual' | 'audio'; // $bindable
    fixedRootNote: Note | 'random';     // $bindable
  };
  let {
    exercise,
    enabledModes = $bindable(),
    shapeVariant = $bindable(),
    octaveJudge = $bindable(),
    boxSpan = $bindable(),
    inputMode = $bindable(),
    micSensitivity = $bindable(),
    micDeviceId = $bindable(),
    micDevices,
    identifyPromptMode = $bindable(),
    fixedRootNote = $bindable()
  }: Props = $props();

  // Mic input works for the box (notes matched by pitch) and for the octave run
  // judged by pitch. Not for fixed-fingering octave: mic can't verify position.
  const micEligible = $derived(
    exercise === 'play-shape' &&
      (shapeVariant === 'box' || (shapeVariant === 'octave' && octaveJudge === 'pitch'))
  );
  // Keep the input mode valid when the variant/judge change out from under it.
  $effect(() => {
    if (inputMode === 'mic' && !micEligible) inputMode = 'click';
  });

  // Choosing mic on a fixed-fingering octave switches judging to by-pitch.
  function pickInput(v: 'click' | 'mic') {
    if (v === 'mic' && shapeVariant === 'octave' && octaveJudge === 'fixed') octaveJudge = 'pitch';
  }

  function toggleMode(m: Mode) {
    enabledModes = enabledModes.includes(m)
      ? enabledModes.filter(x => x !== m)
      : [...enabledModes, m];
  }
</script>

<div class="row">
  <span class="label">Modes</span>
  <div class="chips" role="group" aria-label="Modes">
    {#each MODE_ORDER as m}
      <button
        type="button"
        class="chip"
        class:chip-active={enabledModes.includes(m)}
        aria-pressed={enabledModes.includes(m)}
        onclick={() => toggleMode(m)}
      >{MODE_DISPLAY[m]}</button>
    {/each}
  </div>
  {#if enabledModes.length === 0}
    <span class="hint warn">Enable at least one mode.</span>
  {/if}
</div>

{#if exercise === 'play-shape'}
  <div class="row">
    <span class="label">Shape</span>
    <ChipGroup
      bind:value={shapeVariant}
      label="Shape"
      options={[
        { value: 'octave', label: 'One octave' },
        { value: 'box', label: 'Position box' }
      ]}
    />
  </div>

  {#if shapeVariant === 'octave'}
    <div class="row">
      <span class="label">Judging</span>
      <ChipGroup
        bind:value={octaveJudge}
        label="Judging"
        options={[
          { value: 'fixed', label: 'Fixed fingering' },
          { value: 'pitch', label: 'Any position (by pitch)' }
        ]}
      />
    </div>
  {:else}
    <div class="row">
      <label class="label" for="span">Box span (frets)</label>
      <input id="span" type="number" min="3" step="1" bind:value={boxSpan} />
    </div>
  {/if}

  <div class="row">
    <span class="label">Input</span>
    <ChipGroup
      bind:value={inputMode}
      label="Input"
      onpick={pickInput}
      options={[
        { value: 'click', label: 'Click the notes' },
        { value: 'mic', label: 'Play (mic)' }
      ]}
    />
    {#if inputMode === 'mic'}
      <MicSettings bind:sensitivity={micSensitivity} bind:deviceId={micDeviceId} devices={micDevices} />
      <span class="hint">Adjustable mid-session from the pause screen too. Device names appear after you allow mic access.</span>
    {/if}
  </div>
{:else}
  <div class="row">
    <span class="label">Prompt</span>
    <ChipGroup
      bind:value={identifyPromptMode}
      label="Prompt"
      options={[
        { value: 'visual', label: 'See the notes' },
        { value: 'audio', label: 'Hear the scale' }
      ]}
    />
  </div>
{/if}

<div class="row">
  <span class="label">Root</span>
  <NotePicker bind:value={fixedRootNote} label="Root" randomLabel="Random" />
</div>

<style>
  .hint.warn { color: #e07a5f; opacity: 1; }
  input[type="number"] { width: 80px; padding: 6px; }
</style>
