# Guitar Exercises — Root Notes Exercise (v1)

**Date:** 2026-05-18
**Status:** Design approved; ready for implementation plan

## Overview

A local-only web app for guitar practice. The first (and currently only) exercise is **Root Notes**: the user picks a root note (e.g., "A"), the app highlights a starting position on a fretboard, and the user clicks the closest position on any string that contains the target root note. After a timed session, the user sees stats about which positions of that note they're slowest or weakest at finding.

The architecture deliberately separates a small, exercise-agnostic shell (start/session/report screens, fretboard widget, timer) from exercise-specific logic (prompts, scoring, reports), so a second exercise type can be added later by implementing one interface.

## Goals

- Help the user learn to find root notes anywhere on a 22-fret guitar fretboard.
- Provide useful within-session feedback: accuracy, error count, average response time, and per-position breakdown showing which target positions the user is weakest at.
- Be extensible enough that a second exercise (intervals, scales, etc.) can be added without rewriting the session shell, but no more abstract than that.

## Non-goals

- Multi-tuning support. Standard tuning (E A D G B E, high E = string 1) only.
- Cross-session history or trend tracking. Reports are within-session.
- User accounts, multi-device sync, server-side anything.
- Multiple exercise types in v1. Architecture supports adding more later; only Root Notes is implemented.
- Mobile-specific responsive design. Should work on a desktop browser. Tablet-friendly is a bonus, not a requirement.

## User flow

1. **Start screen** — user picks the target root note from a dropdown, picks a session duration (1/3/5/10/custom minutes), optionally toggles "Show all labels" (warm-up mode) and "Play notes" (audio), and clicks Start.
2. **Session screen** — fretboard appears with one prompt position highlighted (a colored dot, showing its note name). User clicks the closest fret/string that is the target root note. Immediate visual feedback (and audio, if enabled): correct = green flash, wrong = red flash on the clicked spot followed by a green flash on the actual correct spot. Auto-advance to the next prompt. Timer counts down in the header. User can abort via "End session" → confirm → see partial report.
3. **Report screen** — accuracy %, correct/total, errors, avg time; a heatmap fretboard showing accuracy at each target position the user encountered; a "weakest 3 positions" callout; buttons to practice again with the same settings or return to Start.

## Exercise rules (Root Notes)

- **Target note:** a single chromatic note selected by the user before the session.
- **Prompt:** a randomly selected `(string, fret)` position on the 22-fret fretboard. Uniform random across all valid positions. The picker should avoid producing the exact same `(string, fret)` two prompts in a row. The prompt position may itself be the target note (in which case the correct answer is the prompt position itself; fret distance = 0).
- **Correct answer:** the `(string, fret)` of the target note that is closest to the prompt position. "Closest" = minimum `|fret - prompt.fret|`. **Tie-break:** prefer the higher-pitched string (lower string number internally; string 1 = high E).
- **Answer flow:** first click is final. Wrong answers cannot be retried within a prompt. On a wrong answer, the correct position is briefly flashed (~600 ms) so the user learns. Input is locked during this flash window. Then auto-advance.

## Architecture

A Svelte 5 + Vite + TypeScript single-page app. Three top-level screens — `StartScreen`, `SessionScreen`, `ReportScreen` — wrapped by a thin `App.svelte` that renders the current screen based on local state and passes data between them.

Exercise-agnostic primitives live in `lib/components/` (Fretboard, SessionRunner shell) and `lib/music/`. Exercise-specific code lives behind an `Exercise<Prompt, Answer, Report>` interface in `lib/exercise/`.

### Project layout

```
src/
  App.svelte                     # screen router (start | session | report)
  main.ts                        # mounts App.svelte
  app.css                        # global styles
  lib/
    music/
      notes.ts                   # chromatic scale, note math, fretboard map, closest-position calc
      tuning.ts                  # STANDARD_TUNING constant
    audio/
      pluck.ts                   # Karplus-Strong synth; playPluck(string, fret)
    exercise/
      Exercise.ts                # generic interface
      rootNotes/
        RootNotesExercise.ts     # implements Exercise; prompt selection, scoring, report aggregation
        types.ts                 # RootNotesConfig | Prompt | Answer | Report
    components/
      StartScreen.svelte         # config form (exercise picker + root-notes config)
      SessionScreen.svelte       # holds timer; renders Fretboard with current prompt
      ReportScreen.svelte        # renders stats + heatmap fretboard
      Fretboard.svelte           # generic SVG fretboard widget
    storage/
      prefs.ts                   # safe localStorage wrapper for preferences
index.html
vite.config.ts
tsconfig.json
package.json
```

### Why this layout

- **Fretboard.svelte** is generic. It takes props (`highlights`, `labelsVisible`, `tuning`, `maxFret`) and emits `(string, fret)` on click. Reusable by any future exercise.
- **SessionScreen.svelte** is partly exercise-agnostic — it holds the timer and drives the prompt loop, but it currently renders a Fretboard directly because that's what Root Notes needs. A second exercise that doesn't use a fretboard would either render its own SessionScreen variant or, in a refactor, the SessionScreen could be split into a generic timer shell plus an exercise-supplied "main area" component. We defer that until a second exercise actually appears (YAGNI).
- **RootNotesExercise.ts** is pure TypeScript. No DOM, no Svelte. Unit-testable in isolation.

## Music model (`lib/music/notes.ts`)

```ts
// 12-tone chromatic scale, sharp names as the canonical internal representation.
export const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
export type Note = typeof CHROMATIC[number];

// Display labels for the root-note dropdown — enharmonic pairs shown together.
export const NOTE_DISPLAY: Record<Note, string> = {
  'C':'C', 'C#':'C♯/D♭', 'D':'D', 'D#':'D♯/E♭', 'E':'E', 'F':'F',
  'F#':'F♯/G♭', 'G':'G', 'G#':'G♯/A♭', 'A':'A', 'A#':'A♯/B♭', 'B':'B'
};

// Standard tuning. String 1 = high E (highest pitch); string 6 = low E.
export const STANDARD_TUNING: Record<1|2|3|4|5|6, Note> =
  { 1:'E', 2:'B', 3:'G', 4:'D', 5:'A', 6:'E' };

export type StringNum = 1 | 2 | 3 | 4 | 5 | 6;
export type Fret = number; // 0..22

export function noteAt(string: StringNum, fret: Fret): Note;
export function allPositionsOf(note: Note, maxFret: Fret): Array<{string: StringNum, fret: Fret}>;

// Closest target position from a starting `from` position.
// Rule: minimize |fret - from.fret|; tie-break by lowest string number (highest pitch).
export function closestPositionOf(
  target: Note,
  from: {string: StringNum, fret: Fret},
  maxFret: Fret
): {string: StringNum, fret: Fret};
```

## Exercise interface (`lib/exercise/Exercise.ts`)

```ts
export interface Exercise<Config, Prompt, Answer, Report> {
  start(config: Config): void;
  getNextPrompt(): Prompt;
  submitAnswer(answer: Answer): AnswerResult<Answer>;
  getReport(): Report;
}

export interface AnswerResult<Answer> {
  correct: boolean;
  correctAnswer: Answer;
  elapsedMs: number;
}
```

The interface is small. Adding a second exercise = implementing these four methods. If a future exercise needs something the interface doesn't expose, the interface grows by one method — not a redesign.

## Root Notes specifics (`lib/exercise/rootNotes/`)

```ts
export interface RootNotesConfig {
  targetNote: Note;
  durationSec: number;     // session length in seconds
  maxFret: number;          // = 22
  showAllLabels: boolean;   // warm-up mode (labels visible everywhere)
  playSound: boolean;       // audio feedback on/off
}

export interface RootNotesPrompt {
  highlight: { string: StringNum; fret: Fret };
  highlightNote: Note;     // always shown on the highlight dot
}

export type RootNotesAnswer = { string: StringNum; fret: Fret };

export interface RootNotesReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;        // 0..1
  avgTimeMs: number;
  perTargetStats: Array<{
    position: { string: StringNum; fret: Fret };  // a correct-answer position seen this session
    timesAsked: number;
    correctCount: number;
    avgTimeMs: number;
  }>;
}
```

**Prompt selection:** uniform random across all `(string, fret)` pairs with `0 ≤ fret ≤ 22` and `1 ≤ string ≤ 6`. Reject any pick that equals the immediately previous prompt; re-pick.

**Stats keying:** `perTargetStats` is keyed by the *correct answer position* — i.e., where the target note actually was, not where the prompt highlight was. This matches the user goal: "show me which positions of my target note I struggle to find."

## Fretboard component (`Fretboard.svelte`)

Props in, click events out. No knowledge of the exercise.

```svelte
<Fretboard
  tuning={STANDARD_TUNING}
  maxFret={22}
  highlights={[ { string: 3, fret: 7, note: 'D', kind: 'prompt' } ]}
  labelsVisible={false}
  on:click={(e) => /* e.detail = { string: 4, fret: 7 } */}
/>
```

**Rendering:**
- Landscape SVG. Nut on the left, frets 1..22 ascending right.
- High E on top, low E on bottom (standard fretboard-diagram convention).
- String labels (e B G D A E top-to-bottom) shown to the left of the nut.
- Standard inlay dots at frets 3, 5, 7, 9, 12 (double), 15, 17, 19, 21.
- Each `(string, fret)` intersection (including `fret=0` open strings) is a transparent clickable hit-area covering the surrounding fret space. Clicks always resolve to a position.
- Responsive: `viewBox` scales to container width; CSS enforces a sensible minimum width so 22 frets stay legible.

**Highlight kinds (in `highlights` prop):**
- `prompt` — solid colored dot with the note name shown inside.
- `correct-flash` — green pulse (~600 ms) used to reveal the correct answer after a wrong click.
- `user-correct` — brief green flash at the user's clicked position (~200 ms).
- `user-wrong` — brief red flash at the user's clicked position (~200 ms).
- `heatmap` — used by the ReportScreen; renders a dot at the position colored by accuracy (red ↔ green gradient).

**Labels:** when `labelsVisible=false` (default), only positions with explicit highlights show note names. When `true`, every `(string, fret)` shows its note as a small label; the target note (passed as `targetHighlightNote` prop) is rendered in the accent color for scannability.

## Screen specs

### StartScreen

- App title.
- Exercise selector dropdown. Only "Root Notes" available for now; the dropdown is shown for forward-compatibility with future exercises.
- Root note dropdown (12 entries via `NOTE_DISPLAY`).
- Duration chips: `1m / 3m / 5m / 10m / Custom`. Custom reveals a numeric input (seconds). Validation: positive integer.
- Toggles: "Show all labels (warm-up)" and "Play notes."
- Start button (disabled while config invalid).
- On mount, preferences (last note, last duration, label toggle, sound toggle) are loaded from localStorage. On Start, current values are saved.

### SessionScreen

- Header bar: target note (large), countdown timer (mm:ss), running tally `✓ N · ✗ M`, "End session" button.
- Main area: Fretboard occupying most of the height, with the current prompt as a single `prompt`-kind highlight. When `showAllLabels` is on, labels are visible across the board (target note in accent color).
- Click handler:
  1. Read clicked `(string, fret)`.
  2. If audio enabled: `playPluck(string, fret)` immediately.
  3. Lock input.
  4. Call `exercise.submitAnswer({string, fret})` → `{correct, correctAnswer, elapsedMs}`.
  5. Briefly add a `user-correct` or `user-wrong` highlight at the clicked spot (~200 ms).
  6. If wrong: after the user-wrong flash, add a `correct-flash` highlight at `correctAnswer` and, if audio enabled, `playPluck(correctAnswer)`. Hold ~600 ms.
  7. Unlock input, call `exercise.getNextPrompt()`, render the new prompt.
- Timer: wall-clock based (`Date.now()` deltas), not `setInterval` drift. Updates display once per second. When time reaches zero, the *current* prompt is allowed to complete (soft cutoff). After that prompt resolves, the screen transitions to `ReportScreen` carrying `exercise.getReport()`.
- "End session" → confirm dialog → transitions to ReportScreen showing partial stats.

### ReportScreen

- Top: four stat cards — Accuracy %, Correct/Total, Errors, Average time (seconds, one decimal).
- Heatmap fretboard: `Fretboard` rendered in heatmap mode. Each entry in `report.perTargetStats` becomes a dot at `position` colored by `correctCount / timesAsked` on a red-to-green gradient. Positions never asked render nothing. Hover/tap shows `times asked · % correct · avg time`.
- Heatmap legend strip below the fretboard.
- Weakest-positions callout: top 3 positions sorted by lowest accuracy, ties broken by slowest avg time. Format: "String G, fret 2 — 1/4 correct, avg 5.2s." Skip positions with fewer than 2 attempts (insufficient sample).
- Buttons: "Practice again" (starts a fresh session with the same `RootNotesConfig` — timer reset to full duration, stats cleared) and "Back to start" (returns to StartScreen).

## Audio (`lib/audio/pluck.ts`)

- Web Audio API directly. No library dependencies.
- Karplus-Strong plucked-string synthesis (~40 lines): excite a delay line with noise, feed back with a one-zero lowpass, pluck length ≈ sample rate / target frequency. Sounds plausibly guitar-like; decays naturally.
- If Karplus-Strong proves fiddly during implementation, fall back to a `OscillatorNode` (triangle wave) with an exponential gain envelope. The interface (`playPluck(string, fret)`) is unchanged.
- Frequency calc:
  - Open-string MIDI numbers: `{1:64, 2:59, 3:55, 4:50, 5:45, 6:40}` (E4..E2)
  - Note MIDI = openMIDI + fret
  - Frequency = `440 * 2^((midi - 69) / 12)` Hz
- AudioContext is lazily constructed on the first call (browser autoplay policy: needs a user gesture). If construction fails or is blocked, the function silently no-ops.
- Concurrent calls overlap and decay naturally. No locking needed.

## Preferences (`lib/storage/prefs.ts`)

- Single localStorage key: `guitar-exercises.prefs.v1`.
- Shape: `{ targetNote: Note; durationSec: number; showAllLabels: boolean; playSound: boolean }`.
- `loadPrefs(): Partial<Prefs>` — returns `{}` if missing, malformed, or localStorage is unavailable.
- `savePrefs(prefs: Prefs): void` — wraps localStorage; swallows quota and access errors.

## Edge cases and error handling

- **Window resize during session:** SVG `viewBox` scales; no recomputation.
- **Clicks between fret/string positions:** hit-areas tile the fretboard with no gaps; every click resolves.
- **Click during the wrong-answer flash window:** input is locked. Clicks are ignored from `submitAnswer` until the next prompt is rendered.
- **Browser tab loses focus:** timer is wall-clock based; coming back to a near-expired timer just means very few prompts remain.
- **localStorage unavailable or full:** prefs silently fall back to defaults (current selection in dropdowns); app still works.
- **Custom duration ≤ 0 or non-integer:** Start button disabled; inline validation message.
- **Two tabs open simultaneously:** each tab has its own session state. Last-write-wins on prefs save.
- **Pure music functions** (`noteAt`, `allPositionsOf`, `closestPositionOf`) throw on out-of-range input — these are programmer errors, not user errors. Do not try/catch them in callers.
- **AudioContext construction fails:** `playPluck` silently no-ops. Sound toggle remains user-visible but has no audible effect; this is acceptable.

## Testing

- **Vitest** for unit and component tests.
- `lib/music/notes.ts` unit tests:
  - `noteAt(string, fret)` for every position 1..6 × 0..22 against a known truth table.
  - `allPositionsOf('A', 22)` returns the expected 11 positions in a canonical order.
  - `closestPositionOf` covers: simple cases, ties broken by lowest string number, prompt = target case (returns prompt position itself), positions at fret boundaries (0, 22).
- `RootNotesExercise.ts` unit tests:
  - `getNextPrompt` over many invocations: never produces invalid `(string, fret)` and never repeats the immediately previous prompt.
  - `submitAnswer` classifies right and wrong correctly; `correctAnswer` matches `closestPositionOf`.
  - `getReport` produces correct aggregates when fed a scripted sequence of prompts and answers.
- `Fretboard.svelte` component tests:
  - Clicking a known coordinate fires `click` event with the right `{string, fret}`.
  - `labelsVisible` toggle changes the rendered label set.
  - `highlights` prop renders the expected dots with the expected kinds.
- No end-to-end tests in v1. The screen orchestration is thin enough to verify manually.

## Stack and tooling

- **Svelte 5** + **Vite** + **TypeScript** (strict mode).
- **Vitest** for tests; **@testing-library/svelte** for component tests.
- ESLint + Prettier with defaults.
- No CSS framework. Plain CSS with custom properties for theme tokens.
- Node 20+ assumed for dev.

## Out of scope (for v1)

- Alternative tunings (drop D, DADGAD, etc.).
- A second exercise type. Architecture supports adding one; not implementing one.
- Session history across visits.
- A "Pause" button. (Abort + partial report is the only way to interrupt; this is intentional.)
- Mobile-specific layout. Should work on desktop browsers at typical widths.
- Internationalization. Strings are English-only.
- Accessibility beyond basic semantic HTML and keyboard focus — full a11y is deferred.

## Open questions

None at design time. All clarifications were resolved during brainstorming.
