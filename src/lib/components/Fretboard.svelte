<script lang="ts" module>
  import type { Note, Fret } from '../music/notes';
  import type { StringNum } from '../music/tuning';

  export type HighlightKind =
    | 'prompt'
    | 'correct-flash'
    | 'user-correct'
    | 'user-wrong'
    | 'closest-from-click'
    | 'heatmap';

  export interface Highlight {
    string: StringNum;
    fret: Fret;
    note: Note;
    kind: HighlightKind;
    accuracy?: number; // 0..1, used only for kind='heatmap'
  }
</script>

<script lang="ts">
  import { noteAt, allPositionsOf } from '../music/notes';

  type Props = {
    maxFret: number;
    labelsVisible?: boolean;
    targetHighlightNote?: Note;
    showRootMarkers?: boolean;
    highlights?: Highlight[];
    onSelect?: (pos: { string: StringNum; fret: Fret }) => void;
  };

  let {
    maxFret,
    labelsVisible = false,
    targetHighlightNote,
    showRootMarkers = false,
    highlights = [],
    onSelect
  }: Props = $props();

  const VB_W = 1100;
  const VB_H = 200;
  const BOARD_X = 60;
  const BOARD_Y = 20;
  const BOARD_W = 1020;
  const BOARD_H = 160;
  const NUT_W = 10;

  const fretSpacing = $derived((BOARD_W - NUT_W) / (maxFret + 1));
  const fretLines = $derived(
    Array.from({ length: maxFret }, (_, i) => BOARD_X + NUT_W + (i + 1) * fretSpacing)
  );
  const fretCenters = $derived(
    Array.from({ length: maxFret + 1 }, (_, i) => BOARD_X + NUT_W + (i + 0.5) * fretSpacing)
  );

  const stringYs = [40, 64, 88, 112, 136, 160];
  const stringWidths = [1, 1.4, 1.8, 2.2, 2.7, 3.2];
  const stringLabels = ['e', 'B', 'G', 'D', 'A', 'E'];
  const inlaySingles = [3, 5, 7, 9, 15, 17, 19, 21];
  const inlayDoubles = [12, 24];

  const rootMarkers = $derived(
    showRootMarkers && targetHighlightNote !== undefined
      ? allPositionsOf(targetHighlightNote, maxFret)
      : []
  );

  function strYIndex(s: StringNum): number {
    return s - 1;
  }

  function heatmapColor(accuracy: number): string {
    // 0 -> red, 0.5 -> yellow, 1 -> green
    const clamped = Math.max(0, Math.min(1, accuracy));
    if (clamped < 0.5) {
      const t = clamped * 2;
      const r = 214, g = Math.round(90 + (197 - 90) * t), b = Math.round(61 + (74 - 61) * t);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const t = (clamped - 0.5) * 2;
      const r = Math.round(224 + (95 - 224) * t),
            g = Math.round(197 + (179 - 197) * t),
            b = Math.round(74 + (90 - 74) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  function highlightFill(h: Highlight): string {
    switch (h.kind) {
      case 'prompt':             return '#ff8c42';
      case 'correct-flash':      return '#5fb35a';
      case 'user-correct':       return '#a3d977';
      case 'user-wrong':         return '#d65a3d';
      case 'closest-from-click': return '#14b8a6';
      case 'heatmap':            return heatmapColor(h.accuracy ?? 0);
    }
  }

  // Visual properties keyed by kind. The 'closest-from-click' kind mirrors the
  // root-marker styling (smaller circle, dark text on teal) so the player
  // reads it as "this is just where the nearest target lives" rather than
  // "this is the answer."
  function highlightRadius(kind: HighlightKind): number {
    return kind === 'closest-from-click' ? 11 : 13;
  }
  function highlightTextFill(kind: HighlightKind): string {
    return kind === 'closest-from-click' ? '#0a1a18' : '#1a1a1a';
  }
</script>

<svg viewBox="0 0 {VB_W} {VB_H}" class="fretboard" xmlns="http://www.w3.org/2000/svg">
  <rect x={BOARD_X} y={BOARD_Y} width={BOARD_W} height={BOARD_H} fill="#5b3a22" />
  <rect x={BOARD_X} y={BOARD_Y} width={NUT_W} height={BOARD_H} fill="#e6e1d6" />

  <g stroke="#bfb8a8" stroke-width="2">
    {#each fretLines as x}
      <line data-role="fret" x1={x} y1={BOARD_Y} x2={x} y2={BOARD_Y + BOARD_H} />
    {/each}
  </g>

  <g fill="#d9c896">
    {#each inlaySingles as f}
      {#if f <= maxFret}
        <circle cx={fretCenters[f]} cy={BOARD_Y + BOARD_H / 2} r="5" />
      {/if}
    {/each}
    {#each inlayDoubles as f}
      {#if f <= maxFret}
        <circle cx={fretCenters[f]} cy={BOARD_Y + BOARD_H * 0.3} r="5" />
        <circle cx={fretCenters[f]} cy={BOARD_Y + BOARD_H * 0.7} r="5" />
      {/if}
    {/each}
  </g>

  <g stroke="#e8e3d3" stroke-linecap="round">
    {#each stringYs as y, i}
      <line
        data-role="string"
        x1={BOARD_X}
        y1={y}
        x2={BOARD_X + BOARD_W}
        y2={y}
        stroke-width={stringWidths[i]}
      />
    {/each}
  </g>

  <g fill="#e8e3d3" font-family="ui-sans-serif, system-ui" font-size="13" font-weight="600" text-anchor="middle">
    {#each stringLabels as label, i}
      <text data-role="string-label" x={36} y={stringYs[i] + 4}>{label}</text>
    {/each}
  </g>

  <g fill="#9c9384" font-family="ui-sans-serif, system-ui" font-size="11" text-anchor="middle">
    {#each fretCenters as cx, i}
      <text data-role="fret-number" x={cx} y={BOARD_Y + BOARD_H + 15}>{i}</text>
    {/each}
  </g>

  {#if labelsVisible}
    <g font-family="ui-sans-serif, system-ui" font-size="9" text-anchor="middle">
      {#each [1,2,3,4,5,6] as s}
        {#each Array(maxFret + 1) as _, f}
          {@const note = noteAt(s as StringNum, f)}
          {@const isTarget = targetHighlightNote !== undefined && note === targetHighlightNote}
          <text
            data-role="position-label"
            data-target={isTarget ? 'true' : 'false'}
            x={fretCenters[f]}
            y={stringYs[(s as number) - 1] + 4}
            fill={isTarget ? '#ff8c42' : '#cfc6b3'}
            font-weight={isTarget ? '700' : '400'}
          >{note}</text>
        {/each}
      {/each}
    </g>
  {/if}

  <!-- Root-note position markers -->
  {#if rootMarkers.length > 0 && targetHighlightNote !== undefined}
    <g style="pointer-events: none;">
      {#each rootMarkers as m}
        <g data-role="root-marker">
          <circle
            cx={fretCenters[m.fret]}
            cy={stringYs[m.string - 1]}
            r="11"
            fill="#14b8a6"
            stroke="#fff"
            stroke-width="2"
          />
          <text
            x={fretCenters[m.fret]}
            y={stringYs[m.string - 1] + 4}
            fill="#0a1a18"
            font-family="ui-sans-serif, system-ui"
            font-size="11"
            font-weight="700"
            text-anchor="middle"
          >{targetHighlightNote}</text>
        </g>
      {/each}
    </g>
  {/if}

  <g style="pointer-events: none;">
    {#each highlights as h}
      <g data-role="highlight" data-kind={h.kind}>
        <circle
          cx={fretCenters[h.fret]}
          cy={stringYs[strYIndex(h.string)]}
          r={highlightRadius(h.kind)}
          fill={highlightFill(h)}
          stroke="#fff"
          stroke-width="2"
        />
        {#if h.kind !== 'prompt'}
          <text
            x={fretCenters[h.fret]}
            y={stringYs[strYIndex(h.string)] + 4}
            fill={highlightTextFill(h.kind)}
            font-family="ui-sans-serif, system-ui"
            font-size="11"
            font-weight="700"
            text-anchor="middle"
          >{h.note}</text>
        {/if}
      </g>
    {/each}
  </g>
  <!-- Hit areas (transparent rects on top — visual layers above set pointer-events: none) -->
  <g>
    {#each [1,2,3,4,5,6] as s}
      {#each Array(maxFret + 1) as _, f}
        <!-- Invisible hit target for mouse/touch click-to-answer. No keyboard
             affordance is provided today (the fretboard answers are entered
             by pointing); marking role="button" satisfies a11y semantics and
             we explicitly opt out of the click-without-keys warning. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <rect
          data-role="hit"
          data-string={s}
          data-fret={f}
          role="button"
          aria-label={`String ${s}, fret ${f}`}
          tabindex="-1"
          x={fretCenters[f] - fretSpacing / 2}
          y={stringYs[(s as number) - 1] - 11}
          width={fretSpacing}
          height={22}
          fill="transparent"
          style="cursor: pointer;"
          onclick={() => onSelect?.({ string: s as StringNum, fret: f as Fret })}
        />
      {/each}
    {/each}
  </g>
</svg>

<style>
  .fretboard {
    width: 100%;
    display: block;
    min-width: 800px;
  }
</style>
