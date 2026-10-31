<script lang="ts">
  // Live cents readout: note name, signed cents, and a needle (green within ±15¢).
  import { IN_TUNE_CENTS, type TunerReading } from '../audio/tuner';

  let { reading, compact = false }: { reading: TunerReading | null; compact?: boolean } = $props();
  const inTune = $derived(reading !== null && Math.abs(reading.cents) <= IN_TUNE_CENTS);
</script>

<div class="tuner" class:compact class:intune={inTune} class:off={reading && !inTune} aria-label="Tuner">
  <span class="tnote">{reading?.note ?? '–'}</span>
  <span class="scale" aria-hidden="true">
    <span class="center"></span>
    {#if reading}<span class="needle" style:left="{50 + reading.cents}%"></span>{/if}
  </span>
  <span class="tcents">{reading ? (reading.cents > 0 ? '+' : '') + reading.cents + '¢' : ''}</span>
</div>

<style>
  .tuner { height: 44px; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .tnote { font-size: 32px; font-weight: 800; min-width: 56px; text-align: right; }
  .tcents { font-size: 16px; opacity: 0.7; min-width: 60px; }
  .scale { position: relative; width: 100px; height: 14px; border-radius: 7px; background: rgba(136, 136, 136, 0.3); }
  .center { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: rgba(136, 136, 136, 0.8); }
  .needle { position: absolute; top: -2px; bottom: -2px; width: 4px; margin-left: -2px; border-radius: 2px; background: currentColor; }
  .compact { height: auto; gap: 6px; }
  .compact .tnote { font-size: 16px; min-width: 32px; }
  .compact .tcents { font-size: 13px; min-width: 40px; }
  .compact .scale { width: 70px; height: 10px; }
  .intune { color: #2e9e3a; }
  .off { color: #d97a00; }
</style>
