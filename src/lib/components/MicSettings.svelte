<script lang="ts">
  type Props = {
    sensitivity?: number;       // $bindable, 0..1; omit to hide the slider
    deviceId: string | null;    // $bindable
    devices: Array<{ deviceId: string; label: string }>;
  };
  let {
    sensitivity = $bindable(),
    deviceId = $bindable(),
    devices
  }: Props = $props();
</script>

<div class="mic-settings">
  {#if sensitivity !== undefined}
    <label class="field">
      <span>Mic sensitivity</span>
      <input type="range" min="0" max="1" step="0.05" bind:value={sensitivity} aria-label="Mic sensitivity" />
      <span class="val">{sensitivity < 0.34 ? 'chill' : sensitivity > 0.66 ? 'sensitive' : 'medium'}</span>
    </label>
  {/if}
  <label class="field">
    <span>Input source</span>
    <select bind:value={deviceId} aria-label="Input source">
      <option value={null}>Default microphone</option>
      {#each devices as d}
        <option value={d.deviceId}>{d.label}</option>
      {/each}
    </select>
  </label>
</div>

<style>
  .mic-settings { display: flex; flex-direction: column; gap: 10px; }
  .field { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .field > span:first-child { min-width: 110px; }
  .field input[type="range"] { flex: 1; }
  .val { min-width: 70px; opacity: 0.8; }
  select { padding: 4px; min-width: 0; max-width: 100%; }
</style>
