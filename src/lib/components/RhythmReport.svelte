<script lang="ts">
  import type { RhythmConfig, RhythmReport, TargetKind } from '../exercise/rhythm/types';
  import { hasCalib } from '../audio/calibration';
  import { IDEATE_HASH } from '../routing/hash';

  type Props = { report: RhythmReport; config: RhythmConfig; onPracticeAgain: () => void; onBack: () => void };
  let { report, config, onPracticeAgain, onBack }: Props = $props();

  const KIND_LABEL: Record<TargetKind, string> = { one: 'Beat 1', beat: 'Beats 2–4', and: 'The ands' };
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const ms = (x: number | null) => (x === null ? '—' : `${x} ms`);
  const bias = $derived(
    report.biasMs === null ? '—' : report.biasMs === 0 ? 'on time' : `${Math.abs(report.biasMs)} ms ${report.biasMs > 0 ? 'late' : 'early'}`
  );

  // Timeline: each target's error (late up, early down) in play order; misses on the axis.
  const W = 720, H = 200, PAD_L = 48, PAD_R = 12, PAD_T = 12, PAD_B = 24;
  const range = $derived(Math.max(report.toleranceMs, ...report.results.map(r => Math.abs(r.errorMs ?? 0))));
  const x = (i: number) => PAD_L + (report.results.length <= 1 ? 0.5 : i / (report.results.length - 1)) * (W - PAD_L - PAD_R);
  const y = (e: number) => PAD_T + ((range - e) / (2 * range)) * (H - PAD_T - PAD_B);
</script>

<div class="report">
  <h2>Session report — Rhythm</h2>

  <div class="stats">
    <div class="card"><div class="caption">Accuracy</div><div class="big good">{Math.round(report.accuracy * 100)}%</div></div>
    <div class="card"><div class="caption">Hits / Targets</div><div class="big">{report.correctCount} / {report.totalPrompts}</div></div>
    <div class="card"><div class="caption">Extra hits</div><div class="big bad">{report.extras}</div></div>
    <div class="card"><div class="caption">Mean abs. error</div><div class="big">{ms(report.meanAbsMs)}</div></div>
    <div class="card"><div class="caption">Bias</div><div class="big">{bias}</div></div>
  </div>

  <div class="section">
    <div class="caption">Per target type (hit = within ±{report.toleranceMs} ms)</div>
    <table class="per-mode">
      <thead><tr><th>Target</th><th>Hits</th><th>Hit rate</th><th>Mean abs. error</th></tr></thead>
      <tbody>
        {#each report.perKind as k}
          <tr><td>{KIND_LABEL[k.kind]}</td><td>{k.hits} / {k.targets}</td><td>{pct(k.hits, k.targets)}%</td><td>{ms(k.meanAbsMs)}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if report.results.length > 0}
    <div class="section">
      <div class="caption">Timeline — late above the line, early below, ✕ = missed</div>
      <div class="scatter">
        <svg viewBox="0 0 {W} {H}" class="scatter-svg" role="img" aria-label="Onset error per target">
          <rect x={PAD_L} y={y(report.toleranceMs)} width={W - PAD_L - PAD_R} height={y(-report.toleranceMs) - y(report.toleranceMs)} fill="rgba(95,179,90,0.12)" />
          <line x1={PAD_L} x2={W - PAD_R} y1={y(0)} y2={y(0)} stroke="#888" />
          {#each [...new Set([range, report.toleranceMs, -report.toleranceMs, -range])] as v}
            <text x={PAD_L - 6} y={y(v) + 4} text-anchor="end" font-size="11" fill="currentColor" opacity="0.6">{v > 0 ? '+' : ''}{v}</text>
          {/each}
          {#each report.results as r, i}
            {#if r.errorMs === null}
              <text x={x(i)} y={y(0) + 4} text-anchor="middle" font-size="12" fill="#e07a5f">✕</text>
            {:else}
              <circle cx={x(i)} cy={y(r.errorMs)} r="4" fill="#5fb35a" />
            {/if}
          {/each}
          <text x={PAD_L} y={H - 6} font-size="11" fill="currentColor" opacity="0.6">first target</text>
          <text x={W - PAD_R} y={H - 6} text-anchor="end" font-size="11" fill="currentColor" opacity="0.6">last</text>
        </svg>
      </div>
    </div>
  {/if}

  <div class="muted">
    {#if config.inputMode !== 'mic'}
      Taps are timed against what was audible; keyboard and touch latency (often 10–30 ms) is not corrected.
    {:else if report.calibMs !== 0 || hasCalib()}
      Mic latency offset applied: {report.calibMs} ms.
    {:else}
      No latency calibration was applied. With the mic, a constant late bias is likely input latency:
      <a href={IDEATE_HASH}>calibrate in Ideate</a> (More options → Calibration).
    {/if}
  </div>

  <div class="actions">
    <button class="primary" onclick={onPracticeAgain}>Practice again</button>
    <button onclick={onBack}>Back to start</button>
  </div>
</div>

<style>
  .report { max-width: 1200px; margin: 24px auto; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; }
  .card { background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; }
  .caption { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
  .big { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .good { color: #5fb35a; }
  .bad { color: #e07a5f; }
  .section { display: flex; flex-direction: column; gap: 8px; }
  .scatter { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; }
  .scatter-svg { width: 100%; display: block; }
  .per-mode { width: 100%; border-collapse: collapse; }
  .per-mode th, .per-mode td { text-align: left; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .per-mode th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
  .per-mode td { font-variant-numeric: tabular-nums; }
  .muted { opacity: 0.7; font-size: 14px; }
  .actions { display: flex; gap: 12px; }
  .actions button { padding: 12px 20px; border-radius: 6px; border: 1px solid #888; background: transparent; color: inherit; cursor: pointer; }
  .actions .primary { background: #5fb35a; color: #0a0a0a; border-color: #5fb35a; font-weight: 700; }
</style>
