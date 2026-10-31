<script lang="ts">
  type Props = {
    durationSec: number; // $bindable
    continuous: boolean; // $bindable
  };
  let { durationSec = $bindable(), continuous = $bindable() }: Props = $props();

  const DURATIONS = [
    { label: '1m', sec: 60 },
    { label: '3m', sec: 180 },
    { label: '5m', sec: 300 },
    { label: '10m', sec: 600 }
  ];

  // Initial snapshot only, as before in StartScreen.
  // svelte-ignore state_referenced_locally
  let customMode = $state<boolean>(!continuous && ![60, 180, 300, 600].includes(durationSec));
  // svelte-ignore state_referenced_locally
  let customValue = $state<number>(customMode ? durationSec : 120);

  function pickPreset(sec: number) {
    continuous = false;
    customMode = false;
    durationSec = sec;
  }

  function pickCustom() {
    continuous = false;
    customMode = true;
    durationSec = customValue > 0 ? customValue : 120;
  }

  function pickContinuous() {
    continuous = true;
    customMode = false;
  }

  function onCustomChange(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!Number.isFinite(v) || v <= 0) {
      customValue = 0;
      return;
    }
    customValue = v;
    if (customMode) durationSec = v;
  }
</script>

<div class="chips" role="group" aria-label="Duration">
  {#each DURATIONS as d}
    <button
      type="button"
      class="chip"
      class:chip-active={!continuous && !customMode && durationSec === d.sec}
      aria-pressed={!continuous && !customMode && durationSec === d.sec}
      onclick={() => pickPreset(d.sec)}
    >{d.label}</button>
  {/each}
  <button
    type="button"
    class="chip"
    class:chip-active={!continuous && customMode}
    aria-pressed={!continuous && customMode}
    onclick={pickCustom}
  >Custom</button>
  {#if !continuous && customMode}
    <input
      type="number"
      min="1"
      step="1"
      value={customValue}
      oninput={onCustomChange}
      aria-label="Custom duration in seconds"
    />
    <span class="hint">seconds</span>
  {/if}
  <button
    type="button"
    class="chip"
    class:chip-active={continuous}
    aria-pressed={continuous}
    onclick={pickContinuous}
  >Continuous</button>
</div>

<style>
  input[type="number"] { width: 80px; padding: 6px; }
</style>
