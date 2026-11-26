<script lang="ts">
  import type { StringNum } from '../../music/tuning';
  import type { NoteNamesVariant } from '../../exercise/notenames/types';
  import ChipGroup from './ChipGroup.svelte';
  import MicSettings from '../MicSettings.svelte';

  type Props = {
    variant: NoteNamesVariant;           // $bindable
    strings: StringNum[];                // $bindable
    inputMode: 'click' | 'mic';          // $bindable
    micSensitivity: number;              // $bindable
    micDeviceId: string | null;          // $bindable
    micDevices: Array<{ deviceId: string; label: string }>;
  };
  let {
    variant = $bindable(),
    strings = $bindable(),
    inputMode = $bindable(),
    micSensitivity = $bindable(),
    micDeviceId = $bindable(),
    micDevices
  }: Props = $props();

  // Low E first, the way the strings sit under your picking hand.
  const STRINGS: Array<{ s: StringNum; name: string }> = [
    { s: 6, name: 'E' }, { s: 5, name: 'A' }, { s: 4, name: 'D' }, { s: 3, name: 'G' }, { s: 2, name: 'B' }, { s: 1, name: 'e' }
  ];
  const toggle = (s: StringNum) => (strings = strings.includes(s) ? strings.filter(x => x !== s) : [...strings, s]);
</script>

<div class="row">
  <span class="label">Drill</span>
  <ChipGroup
    bind:value={variant}
    label="Drill"
    options={[
      { value: 'name', label: 'Name the fret' },
      { value: 'play', label: 'Play the note' }
    ]}
  />
</div>
<div class="row">
  <span class="label">Strings</span>
  <div class="chips" role="group" aria-label="Strings">
    {#each STRINGS as { s, name }}
      <button type="button" class="chip" class:chip-active={strings.includes(s)} aria-pressed={strings.includes(s)}
        title="{s === 6 ? 'Low E' : s === 1 ? 'High e' : name} string" onclick={() => toggle(s)}>{name}</button>
    {/each}
  </div>
  {#if strings.length === 0}<span class="hint warn">Pick at least one string.</span>{/if}
</div>
{#if variant === 'play'}
  <div class="row">
    <span class="label">Input</span>
    <ChipGroup
      bind:value={inputMode}
      label="Input"
      options={[
        { value: 'click', label: 'Click the fret' },
        { value: 'mic', label: 'Play (mic)' }
      ]}
    />
    {#if inputMode === 'mic'}
      <MicSettings bind:sensitivity={micSensitivity} bind:deviceId={micDeviceId} devices={micDevices} />
      <span class="hint">Play it at the pitch that string gives; the same pitch on another string also counts.</span>
    {/if}
  </div>
{/if}
