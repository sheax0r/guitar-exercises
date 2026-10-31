<script lang="ts">
  import { untrack } from 'svelte';
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import { noteAt } from '../music/notes';
  import { MODE_DISPLAY } from '../music/modes';
  import { DEGREE_LABELS, type Degree } from '../music/scales';
  import type { ExerciseConfig, ExerciseReport, PerTargetStat } from '../exercise/types';
  import type { ModesReport } from '../exercise/modes/types';
  import type { CagedReport } from '../exercise/caged/types';
  import type { DegreesReport } from '../exercise/degrees/types';
  import type { AnyConfig, AnyReport } from '../exercise/config';

  type Props = {
    report: AnyReport;
    config: AnyConfig;
    onPracticeAgain: () => void;
    onBack: () => void;
  };

  let { report, config, onPracticeAgain, onBack }: Props = $props();

  // Fretboard exercises (root-notes, random-roots, intervals) share the
  // position heatmap report; modes exercises get a per-mode report instead.
  const isRoot = untrack(() =>
    config.exercise === 'root-notes'
    || config.exercise === 'random-roots'
    || config.exercise === 'intervals'
  );

  // Narrowed views. Only one is non-null for a given report. The report is a
  // static snapshot of a finished session, so these are captured once.
  const rootConfig = untrack(() => (isRoot ? (config as ExerciseConfig) : null));
  const rootReport = untrack(() => (isRoot ? (report as ExerciseReport) : null));
  const isCaged = untrack(() => config.exercise === 'caged');
  const isDegrees = untrack(() => config.exercise === 'degrees');
  // Modes and CAGED both report per-group stats (per mode / per shape).
  type GroupStat = { label: string; timesAsked: number; correctCount: number; avgTimeMs: number };
  const groupStats: GroupStat[] = untrack(() =>
    isRoot ? []
    : isCaged ? (report as CagedReport).perShapeStats.map(s => ({ ...s, label: `${s.shape} shape` }))
    : isDegrees ? (report as DegreesReport).perDegreeStats.map(s => ({ ...s, label: s.degree }))
    : (report as ModesReport).perModeStats.map(s => ({ ...s, label: MODE_DISPLAY[s.mode] }))
  );
  const groupName = isCaged ? 'shape' : isDegrees ? 'degree' : 'mode';

  const isRandomRoots = untrack(() => config.exercise === 'random-roots');
  const titleSuffix = isRoot
    ? (isRandomRoots ? 'Random roots (A, E, D)' : `target note: ${rootConfig!.targetNote}`)
    : isCaged ? 'CAGED Shapes'
    : isDegrees ? 'Name the Degree'
    : (config.exercise === 'play-shape' ? 'Play the Shape' : 'Identify the Mode');

  const accuracyPct = $derived(Math.round(report.accuracy * 100));
  const avgTimeSec = $derived(report.avgTimeMs / 1000);

  // --- Root-notes heatmap ----------------------------------------------
  const heatmapHighlights = $derived<Highlight[]>(
    (rootReport?.perTargetStats ?? []).map(s => ({
      string: s.position.string,
      fret: s.position.fret,
      note: noteAt(s.position.string, s.position.fret),
      kind: 'heatmap' as const,
      accuracy: s.timesAsked === 0 ? 0 : s.correctCount / s.timesAsked
    }))
  );

  function statLabel(s: PerTargetStat): string {
    const stringName = ['', 'e', 'B', 'G', 'D', 'A', 'E'][s.position.string];
    const lowOrHigh = s.position.string === 1 ? ' (high)' : s.position.string === 6 ? ' (low)' : '';
    return `String ${stringName}${lowOrHigh}, fret ${s.position.fret}`;
  }

  const weakest = $derived<PerTargetStat[]>(
    (() => {
      const eligible = (rootReport?.perTargetStats ?? []).filter(s => s.timesAsked >= 2);
      eligible.sort((a, b) => {
        const aAcc = a.correctCount / a.timesAsked;
        const bAcc = b.correctCount / b.timesAsked;
        if (aAcc !== bAcc) return aAcc - bAcc;
        return b.avgTimeMs - a.avgTimeMs;
      });
      return eligible.slice(0, 3);
    })()
  );

  // --- Per-group (mode / shape) stats ------------------------------------
  const perModeSorted = $derived<GroupStat[]>(
    [...groupStats].sort((a, b) => isDegrees
      ? DEGREE_LABELS.indexOf(a.label as Degree) - DEGREE_LABELS.indexOf(b.label as Degree)
      : a.label.localeCompare(b.label))
  );

  const weakestModes = $derived<GroupStat[]>(
    (() => {
      const eligible = groupStats.filter(s => s.timesAsked >= 2);
      eligible.sort((a, b) => {
        const aAcc = a.correctCount / a.timesAsked;
        const bAcc = b.correctCount / b.timesAsked;
        if (aAcc !== bAcc) return aAcc - bAcc;
        return b.avgTimeMs - a.avgTimeMs;
      });
      return eligible.slice(0, 3);
    })()
  );

  // --- Timeline scatter (shared) ---------------------------------------
  const SCAT_W = 720;
  const SCAT_H = 220;
  const SCAT_PAD_L = 44;
  const SCAT_PAD_R = 16;
  const SCAT_PAD_T = 12;
  const SCAT_PAD_B = 28;

  const maxElapsedSec = $derived(
    report.attempts.length === 0
      ? 1
      : Math.max(1, Math.ceil(Math.max(...report.attempts.map(a => a.elapsedMs / 1000))))
  );
  const yTicks = $derived.by(() => {
    const m = maxElapsedSec;
    const step = m <= 5 ? 1 : m <= 12 ? 2 : m <= 30 ? 5 : 10;
    const ticks: number[] = [];
    for (let v = 0; v <= m; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== m) ticks.push(m);
    return ticks;
  });
  function xFor(i: number): number {
    const n = report.attempts.length;
    if (n <= 1) return SCAT_PAD_L + (SCAT_W - SCAT_PAD_L - SCAT_PAD_R) / 2;
    const w = SCAT_W - SCAT_PAD_L - SCAT_PAD_R;
    return SCAT_PAD_L + (i / (n - 1)) * w;
  }
  function yFor(sec: number): number {
    const h = SCAT_H - SCAT_PAD_T - SCAT_PAD_B;
    return SCAT_H - SCAT_PAD_B - (sec / maxElapsedSec) * h;
  }
  const avgY = $derived(yFor(avgTimeSec));

  function buildTextReport(): string {
    const lines: string[] = [];
    lines.push(`Session report — ${titleSuffix}`);
    lines.push(`Accuracy: ${accuracyPct}% (${report.correctCount}/${report.totalPrompts})`);
    lines.push(`Errors: ${report.incorrectCount}`);
    lines.push(`Avg time: ${avgTimeSec.toFixed(1)}s`);
    if (isRoot && weakest.length > 0) {
      lines.push('');
      lines.push('Weakest positions:');
      for (const s of weakest) {
        lines.push(`- ${statLabel(s)}: ${s.correctCount}/${s.timesAsked} correct · avg ${(s.avgTimeMs / 1000).toFixed(1)}s`);
      }
    }
    if (!isRoot && perModeSorted.length > 0) {
      lines.push('');
      lines.push(`Per ${groupName}:`);
      for (const s of perModeSorted) {
        const acc = s.timesAsked === 0 ? 0 : Math.round((s.correctCount / s.timesAsked) * 100);
        lines.push(`- ${s.label}: ${s.correctCount}/${s.timesAsked} (${acc}%) · avg ${(s.avgTimeMs / 1000).toFixed(1)}s`);
      }
    }
    return lines.join('\n');
  }

  function buildJsonData(): string {
    const base = {
      generatedAt: new Date().toISOString(),
      config: { ...config },
      summary: {
        totalPrompts: report.totalPrompts,
        correctCount: report.correctCount,
        incorrectCount: report.incorrectCount,
        accuracy: report.accuracy,
        avgTimeMs: report.avgTimeMs
      },
      attempts: report.attempts.map((a, i) => ({ index: i + 1, elapsedMs: a.elapsedMs, correct: a.correct }))
    };
    const detail = isRoot
      ? {
          perTargetStats: (rootReport?.perTargetStats ?? []).map(s => ({
            string: s.position.string,
            fret: s.position.fret,
            timesAsked: s.timesAsked,
            correctCount: s.correctCount,
            avgTimeMs: s.avgTimeMs
          }))
        }
      : isCaged
        ? { perShapeStats: (report as CagedReport).perShapeStats }
        : { perModeStats: (report as ModesReport).perModeStats };
    return JSON.stringify({ ...base, ...detail }, null, 2);
  }

  type CopyState = 'idle' | 'copied' | 'failed';
  let copyReportState = $state<CopyState>('idle');
  let copyDataState = $state<CopyState>('idle');
  let copyReportResetHandle: ReturnType<typeof setTimeout> | null = null;
  let copyDataResetHandle: ReturnType<typeof setTimeout> | null = null;

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(buildTextReport());
      copyReportState = 'copied';
    } catch {
      copyReportState = 'failed';
    }
    if (copyReportResetHandle !== null) clearTimeout(copyReportResetHandle);
    copyReportResetHandle = setTimeout(() => { copyReportState = 'idle'; }, 2000);
  }

  async function copyData() {
    try {
      await navigator.clipboard.writeText(buildJsonData());
      copyDataState = 'copied';
    } catch {
      copyDataState = 'failed';
    }
    if (copyDataResetHandle !== null) clearTimeout(copyDataResetHandle);
    copyDataResetHandle = setTimeout(() => { copyDataState = 'idle'; }, 2000);
  }

  function modeAccPct(s: GroupStat): number {
    return s.timesAsked === 0 ? 0 : Math.round((s.correctCount / s.timesAsked) * 100);
  }
</script>

<div class="report">
  <h2>Session report — {titleSuffix}</h2>

  <div class="stats">
    <div class="card"><div class="caption">Accuracy</div><div class="big good">{accuracyPct}%</div></div>
    <div class="card"><div class="caption">Correct / Total</div><div class="big">{report.correctCount} / {report.totalPrompts}</div></div>
    <div class="card"><div class="caption">Errors</div><div class="big bad">{report.incorrectCount}</div></div>
    <div class="card"><div class="caption">Avg time</div><div class="big">{avgTimeSec.toFixed(1)}s</div></div>
  </div>

  {#if isRoot}
    <div class="section">
      <div class="caption">Heatmap — {isRandomRoots ? 'positions' : `${rootConfig!.targetNote} positions`} you saw this session</div>
      <div class="board">
        <Fretboard maxFret={rootConfig!.maxFret} highlights={heatmapHighlights} />
      </div>
      <div class="legend">
        <span>Less accurate</span>
        <span class="legend-swatch" style="background:#d65a3d"></span>
        <span class="legend-swatch" style="background:#e07a5f"></span>
        <span class="legend-swatch" style="background:#e0c54a"></span>
        <span class="legend-swatch" style="background:#a3d977"></span>
        <span class="legend-swatch" style="background:#5fb35a"></span>
        <span>More accurate</span>
        <span class="legend-blank">Blank = never asked this session</span>
      </div>
    </div>
  {:else}
    <div class="section">
      <div class="caption">Per {groupName}</div>
      {#if perModeSorted.length === 0}
        <div class="muted">No prompts this session.</div>
      {:else}
        <table class="per-mode">
          <thead>
            <tr><th>{isCaged ? 'Shape' : isDegrees ? 'Degree' : 'Mode'}</th><th>Asked</th><th>Accuracy</th><th>Avg time</th></tr>
          </thead>
          <tbody>
            {#each perModeSorted as s}
              <tr>
                <td>{s.label}</td>
                <td>{s.timesAsked}</td>
                <td>{modeAccPct(s)}%</td>
                <td>{(s.avgTimeMs / 1000).toFixed(1)}s</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}

  {#if report.attempts.length > 0}
    <div class="section">
      <div class="caption">Response time per attempt (green = correct, red = wrong)</div>
      <div class="scatter">
        <svg viewBox="0 0 {SCAT_W} {SCAT_H}" class="scatter-svg" xmlns="http://www.w3.org/2000/svg">
          <g stroke="#3a3a3a" stroke-width="1">
            {#each yTicks as t}
              <line x1={SCAT_PAD_L} y1={yFor(t)} x2={SCAT_W - SCAT_PAD_R} y2={yFor(t)} />
            {/each}
          </g>
          <g fill="#9c9384" font-family="ui-sans-serif, system-ui" font-size="11" text-anchor="end">
            {#each yTicks as t}
              <text x={SCAT_PAD_L - 6} y={yFor(t) + 4}>{t}s</text>
            {/each}
          </g>
          <line
            x1={SCAT_PAD_L} y1={SCAT_H - SCAT_PAD_B}
            x2={SCAT_W - SCAT_PAD_R} y2={SCAT_H - SCAT_PAD_B}
            stroke="#6a6a6a" stroke-width="1.5"
          />
          <text
            x={(SCAT_PAD_L + SCAT_W - SCAT_PAD_R) / 2}
            y={SCAT_H - 6}
            fill="#9c9384"
            font-family="ui-sans-serif, system-ui"
            font-size="11"
            text-anchor="middle"
          >Attempt # (1 → {report.attempts.length})</text>
          <line
            x1={SCAT_PAD_L} y1={avgY} x2={SCAT_W - SCAT_PAD_R} y2={avgY}
            stroke="#e8e3d3" stroke-width="1" stroke-dasharray="4 4" opacity="0.5"
          />
          <text
            x={SCAT_W - SCAT_PAD_R - 4}
            y={avgY - 4}
            fill="#e8e3d3"
            font-family="ui-sans-serif, system-ui"
            font-size="10"
            text-anchor="end"
            opacity="0.7"
          >avg {avgTimeSec.toFixed(1)}s</text>
          <g>
            {#each report.attempts as a, i}
              <circle
                cx={xFor(i)}
                cy={yFor(a.elapsedMs / 1000)}
                r="4"
                fill={a.correct ? '#5fb35a' : '#d65a3d'}
                stroke="#1a1a1a"
                stroke-width="1"
              />
            {/each}
          </g>
        </svg>
      </div>
    </div>
  {/if}

  {#if isRoot && weakest.length > 0}
    <div class="section">
      <div class="caption">Weakest positions</div>
      <ul class="weakest">
        {#each weakest as s}
          <li>
            <span><strong>{statLabel(s)}</strong></span>
            <span class="muted">{s.correctCount} / {s.timesAsked} correct · avg {(s.avgTimeMs/1000).toFixed(1)}s</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if !isRoot && weakestModes.length > 0}
    <div class="section">
      <div class="caption">Weakest {groupName}s</div>
      <ul class="weakest">
        {#each weakestModes as s}
          <li>
            <span><strong>{s.label}</strong></span>
            <span class="muted">{s.correctCount} / {s.timesAsked} correct · avg {(s.avgTimeMs/1000).toFixed(1)}s</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="actions">
    <button class="primary" onclick={onPracticeAgain}>Practice again</button>
    <button onclick={onBack}>Back to start</button>
    <button onclick={copyReport}>
      {#if copyReportState === 'copied'}Copied!{:else if copyReportState === 'failed'}Copy failed{:else}Copy report{/if}
    </button>
    <button onclick={copyData}>
      {#if copyDataState === 'copied'}Copied!{:else if copyDataState === 'failed'}Copy failed{:else}Copy data (JSON){/if}
    </button>
  </div>
</div>

<style>
  .report { max-width: 1200px; margin: 24px auto; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .card { background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; }
  .caption { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
  .big { font-size: 32px; font-weight: 700; margin-top: 4px; }
  .good { color: #5fb35a; }
  .bad { color: #e07a5f; }
  .section { display: flex; flex-direction: column; gap: 8px; }
  .board { background: #2a2018; padding: 20px; border-radius: 8px; }
  .legend { display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.7; flex-wrap: wrap; }
  .legend-swatch { display: inline-block; width: 18px; height: 14px; border-radius: 3px; }
  .legend-blank { margin-left: 16px; }
  .scatter { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; }
  .scatter-svg { width: 100%; display: block; max-width: 100%; }
  .per-mode { width: 100%; border-collapse: collapse; }
  .per-mode th, .per-mode td { text-align: left; padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .per-mode th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
  .per-mode td { font-variant-numeric: tabular-nums; }
  .weakest { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .weakest li { display: flex; justify-content: space-between; padding: 10px 14px; background: rgba(0,0,0,0.15); border-radius: 6px; }
  .muted { opacity: 0.6; }
  .actions { display: flex; gap: 12px; }
  .actions button { padding: 12px 20px; border-radius: 6px; border: 1px solid #888; background: transparent; color: inherit; cursor: pointer; }
  .actions .primary { background: #5fb35a; color: #0a0a0a; border-color: #5fb35a; font-weight: 700; }
</style>
