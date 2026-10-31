# Start Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat start-screen form with exercise cards, tiered settings, a unified note picker, a sticky summary/Start bar, and one-click recent sessions.

**Architecture:** Pure helpers (`summarize`, `pushRecent`) in TS modules; small reusable Svelte 5 components (`ChipGroup`, `NotePicker`, `DurationPicker`) and per-exercise settings components under `src/lib/components/start/`; `StartScreen.svelte` keeps all `$state`, prefs load/save, and config assembly, passing values to children via `$bindable` props.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite, Vitest + @testing-library/svelte.

**Spec:** `docs/superpowers/specs/2026-10-31-start-screen-redesign-design.md`

## Global Constraints

- No new dependencies.
- URL hash format (`src/lib/routing/hash.ts`), exercise config types, and session/report screens unchanged.
- `random-roots` remains a valid exercise kind in configs, URLs and prefs.
- Chip markup: `<button type="button" class="chip" class:chip-active={…} aria-pressed={…}>`. Chip CSS lives in `src/app.css` (moved verbatim from StartScreen's `.chip`, `.chip-active`, `.chip:disabled`).
- Run `npm test` and `npm run check` green before each commit.

## Review Focus

1. Legacy prefs `exercise: 'random-roots'` → Root Notes card active and "A/E/D" chip active; Start emits `random-roots`. (Task 4 test.)
2. `recentSessions` containing garbage/legacy-invalid hashes → skipped, no crash, valid ones still render. (Task 4 test.)
3. Starting the same config twice → one recent entry, at front. (Task 1 test.)
4. Mic chosen, then Fixed fingering → Input reverts to click and config emits `inputMode: 'click'`. (Task 4 test.)
5. Phone width: sticky bar must not cover the last control and no horizontal scroll. (Task 5 visual check at 375px.)

---

### Task 1: Summary and recents helpers

**Files:**
- Create: `src/lib/exercise/summary.ts`, `src/lib/exercise/summary.test.ts`
- Create: `src/lib/storage/recent.ts`, `src/lib/storage/recent.test.ts`
- Modify: `src/lib/storage/prefs.ts` (add `recentSessions?: string[]` to `Prefs`)

**Interfaces — Produces:**
- `summarize(config: AnyConfig): string` — rules exactly per spec "Summary text".
- `pushRecent(list: string[] | undefined, hash: string, max?: number /* default 5 */): string[]` — new array: `hash` first, prior duplicates removed, length ≤ max.

- [ ] Tests in `summary.test.ts` (build configs inline):
  - root-notes target `A`, 300s, 12 frets → `'Root Notes · A · 5m · 12 frets'`
  - random-roots → contains `'A/E/D'`, starts with `'Root Notes'`
  - intervals random/random/random, continuous, 24 → `'Intervals · 3rd/5th · any key major/minor · Continuous · 24 frets'`
  - intervals `5th`, keyRoot `C#`, `minor`, 90s → `'Intervals · 5th · C# minor · 90s · 24 frets'` (use `NOTE_DISPLAY['C#']` in the expectation)
  - play-shape modes `['dorian','lydian']`, box span 4, mic, continuous, 24 → `'Play the Shape · Dorian, Lydian · Box (4 frets) · Mic · Continuous · 24 frets'`
  - play-shape all 7 modes, octave, click, 600 → contains `'All modes · Octave · 10m'`
  - identify-mode 5 modes, audio → contains `'5 modes · By ear'`
- [ ] Tests in `recent.test.ts`: undefined list → `['h']`; dedupe moves existing to front (`['a','b','c']` + `'b'` → `['b','a','c']`); cap at 5 drops oldest; custom max honored.
- [ ] Run `npx vitest run src/lib/exercise/summary.test.ts src/lib/storage/recent.test.ts` → FAIL, implement, → PASS.

### Task 2: Shared pickers

**Files:**
- Create: `src/lib/components/start/ChipGroup.svelte`, `NotePicker.svelte`, `DurationPicker.svelte`, `src/lib/components/start/pickers.test.ts`
- Modify: `src/app.css` (receive chip CSS; also add `.label { font-weight: 600; }`, `.hint { opacity: .7; font-size: 14px; }`, `.chips { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }`)

**Interfaces — Produces:**
- `ChipGroup.svelte` — `<script lang="ts" generics="T">`; props `{ value: T ($bindable), options: Array<{ value: T; label: string; title?: string }>, label: string, onpick?: (v: T) => void }`. Renders `<div class="chips" role="group" aria-label={label}>` of chips; click sets `value` then calls `onpick`.
- `NotePicker.svelte` — props `{ value: Note | 'random' ($bindable), label: string, randomLabel?: string }`. When `randomLabel` set, first chip is the random option (value `'random'`). Then 12 chips in `CHROMATIC` order labelled `NOTE_DISPLAY[n]`. Group `aria-label={label}`.
- `DurationPicker.svelte` — props `{ durationSec: number ($bindable), continuous: boolean ($bindable) }`. Moves the Duration preset/Custom/Continuous logic (`DURATIONS`, `pickPreset`, `pickCustom`, `pickContinuous`, `onCustomChange`, `customMode`/`customValue` init) out of StartScreen verbatim; custom number input keeps `aria-label="Custom duration in seconds"`.

- [ ] Tests (`pickers.test.ts`): ChipGroup click changes bound value and marks only that chip `chip-active`/`aria-pressed="true"`; NotePicker without `randomLabel` renders 12 chips, with `randomLabel="A/E/D"` renders 13 with first labelled `A/E/D`, clicking it sets `'random'`; DurationPicker clicking `Continuous` sets `continuous=true`, clicking `Custom` and typing `45` sets `durationSec=45, continuous=false`. (Use a tiny wrapper or `bind:` via testing-library `render` props + reading the component's emitted state through `onpick`/DOM state; DOM `chip-active` assertions suffice.)
- [ ] Fail → implement → pass.

### Task 3: Per-exercise settings components

**Files (create):** `src/lib/components/start/RootNotesSettings.svelte`, `IntervalsSettings.svelte`, `ModesSettings.svelte`

**Interfaces:**
- Consumes: Task 2 components.
- Produces (all props `$bindable` unless noted):
  - `RootNotesSettings` — `{ target: Note | 'random' }`. One row, `.label` "Target note", `NotePicker` with `label="Target note"`, `randomLabel="A/E/D"`, plus hint "A/E/D picks one of A, E, D each prompt." shown only when random.
  - `IntervalsSettings` — `{ intervalKind, keyRoot, keyQuality, direction }`. Rows: Interval (3rd / 5th / Random), Key (`NotePicker` `label="Key"` `randomLabel="Random"`), Key quality (Major / Minor / Random), Direction (Nearest / Ascending; titles "Either way" / "Higher pitch").
  - `ModesSettings` — `{ exercise: 'play-shape' | 'identify-mode' (not bindable), enabledModes, shapeVariant, octaveJudge, boxSpan, inputMode, micSensitivity, micDeviceId, micDevices (not bindable), identifyPromptMode, fixedRootNote }`. Rows: Modes (toggle chips + "Enable at least one mode." warn hint), then for play-shape: Shape, Judging (octave) or Box span `#span` number input (box), Input (Click the notes / Play (mic) — never disabled; picking mic when octave+fixed sets `octaveJudge='pitch'`), MicSettings when mic; for identify: Prompt (See the notes / Hear the scale); then Root (`NotePicker` `label="Root"` `randomLabel="Random"`). Keeps the `$effect` that reverts `inputMode` to `'click'` when no longer mic-eligible.
- Covered by Task 4 tests (these components have no logic StartScreen tests don't exercise).

### Task 4: StartScreen rewrite + recents + README

**Files:**
- Modify: `src/lib/components/StartScreen.svelte`, `src/lib/components/StartScreen.test.ts`, `README.md`

**Interfaces — Consumes:** Tasks 1–3; `parseHash`, `sessionHash` from `src/lib/routing/hash.ts`.

Layout, top to bottom: `h1`; Recent row (only if ≥1 valid recent; chips `class="chip recent"`, text = `summarize(config)`); exercise cards (`<button type="button" class="card" data-exercise=… aria-pressed=…>` with `<strong>` name + `<span>` description, grouped under `<h2>` "Fretboard" / "Modes", grid 2 columns ≥ 520px, 1 column below); selected exercise's settings component; Session section (DurationPicker, Frets ChipGroup 12/22/24); `<details class="more"><summary>More options</summary>…</details>`; sticky `.start-bar` (`position: sticky; bottom: 0`, page background, top border) with `.summary` text and existing `.start-button`. `.start` gets `padding-bottom` ≥ 24px.

State: replace `exercise` + `targetNote` pair with `card: 'root-notes' | 'intervals' | 'play-shape' | 'identify-mode'` and `rootTarget: Note | 'random'` (init: stored exercise `random-roots` → card `root-notes`, rootTarget `'random'`; else rootTarget = `stored.targetNote ?? 'A'`). Derived `exercise` = `card === 'root-notes' && rootTarget === 'random' ? 'random-roots' : card`. `targetNote` for config = `rootTarget === 'random' ? (stored.targetNote ?? 'A') : rootTarget`. Extract config assembly into `buildConfig(): AnyConfig` (existing logic) so the sticky summary is `summarize(buildConfig())` via `$derived`. `handleStart` saves prefs including `recentSessions: pushRecent(stored.recentSessions, sessionHash(config))`. Recent click: for play-shape set `micDeviceId` from current state, save prefs `{ ...loadPrefs(), recentSessions: pushRecent(...) }`, call `onStart`.

- [ ] Rewrite tests: replace `#exercise` select helpers with `card(container, 'play-shape')` clicking `button[data-exercise=…]`; random-roots via clicking the `A/E/D` chip inside `[aria-label="Target note"]`; root-notes target via note chip; keep every existing behavior assertion. Change the mic test: mic chip is enabled under octave+fixed; clicking it emits `inputMode: 'mic'` and `octaveJudge: 'pitch'`. Add:
  - offers 4 cards, no `#exercise` select
  - legacy prefs `{exercise:'random-roots'}` in localStorage → Root Notes card `aria-pressed="true"`, A/E/D chip active, Start emits `random-roots` (Review Focus 1)
  - mic then Fixed fingering → emits `inputMode: 'click'` (Review Focus 4)
  - "More options" is a closed `<details>` containing the "Play notes" checkbox
  - sticky summary text equals `'Root Notes · A · 5m · 24 frets'` on defaults (jsdom matchMedia absent → 24)
  - after Start, prefs `recentSessions` has 1 entry; re-render shows a `.recent` chip; clicking it calls `onStart` with an equal config
  - prefs `recentSessions: ['garbage', '#/session?ex=nope', <valid hash>]` → exactly one `.recent` chip (Review Focus 2)
- [ ] README: list the four exercises (Root Notes with A/E/D option, Intervals, Play the Shape, Identify the Mode) one line each; fix layout tree (`exercise/modes/`, `components/start/`, `routing/`); "Adding another exercise" steps point to `components/start/` settings component + card entry in StartScreen + parse/serialize in `routing/hash.ts`.
- [ ] `npm test` and `npm run check` green; commit.

### Task 5: Verify and ship

- [ ] Whole-branch review (fresh reviewer); fix findings.
- [ ] Browser check at desktop and 375px: each card, More options, mic auto-switch, sticky bar, recents after starting a session.
- [ ] Push branch, open PR, merge to `main`.
