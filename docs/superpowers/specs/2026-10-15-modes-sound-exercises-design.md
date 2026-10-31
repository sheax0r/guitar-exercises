# Modes — Sound & Ear Additions — Design

Date: 2026-10-15
Status: approved for implementation (user pre-authorized spec → implement → ship;
one music-theory decision flagged below for user confirmation)

## Goal

The two mode exercises (Play the Shape, Identify the Mode) currently train
fretboard geometry and note-spelling but not the *sound* of a mode — which the
pedagogy consensus says is the point of modes. Add five optional, orthogonal
features that bring sound and ear into the exercises, and ship them live on
guitar.sheax0r.ca.

All five are **opt-in** (off by default except where noted), so the existing
silent/visual drills are unchanged unless the user turns a feature on.

1. **Drone** — sustain the root under a prompt so the ear attaches the mode's
   colour to its tonal centre.
2. **Characteristic-note highlight** — mark the one degree that defines each
   mode's flavour.
3. **Parallel framing** — hold the root constant across prompts (compare modes
   on one root), vs the current random root.
4. **Audio prompt for Identify the Mode** — hear the scale played and name it,
   instead of reading a silent dot pattern.
5. **Mic input for Play the Shape** — play the notes on a real guitar; detect
   pitch from the mic and judge correctness by ear, not by click.

## Intended outcome (design brief)

- Each feature is a per-exercise toggle on the start screen, persisted in prefs
  and URL hash like every existing option.
- No new exercise *type* is added — the two existing mode exercises gain modes
  of operation. (YAGNI: mic-on-Play-the-Shape already *is* play-by-ear;
  audio-prompt-on-Identify already *is* ear identification.)
- Correctness and reporting semantics are unchanged; these features change how a
  prompt is presented and answered, not how attempts are scored or aggregated.

## Scope boundaries (what each feature does NOT do)

- **Mic** is available **only** for Play the Shape with `shapeVariant: 'octave'`
  and `octaveJudge: 'pitch'` — the one variant that is a pure ascending *pitch
  sequence*. Box and fixed-fingering are inherently positional; the mic hears
  pitch, not string/fret, so it cannot judge them. The start screen disables the
  mic toggle unless that variant is selected.
- **Drone** and **characteristic highlight** apply to both mode exercises.
- **Parallel framing** applies to both mode exercises.
- **Audio prompt** applies to Identify the Mode only.
- No polyphony, no chord detection, no tuner. Monophonic single-note detection
  only.

---

## Music layer: characteristic note (`src/lib/music/modes.ts`)

Net-new data. The characteristic note is the degree that distinguishes a mode
from its parallel reference scale (major for the bright modes, natural minor for
the dark ones). Stored as the **semitone offset** from the root (matching
`MODE_OFFSETS`).

```ts
export const MODE_CHARACTERISTIC: Record<Mode, number> = {
  ionian:     11, // maj7  — see note below
  dorian:      9, // natural 6  (vs natural minor)
  phrygian:    1, // ♭2         (vs natural minor)
  lydian:      6, // ♯4         (vs major)
  mixolydian: 10, // ♭7         (vs major)
  aeolian:     8, // ♭6         (vs Dorian; Aeolian is the reference minor)
  locrian:     6, // ♭5         (the defining diminished 5th)
};

// Pitch-class of the characteristic degree for a given root.
export function characteristicNote(root: Note, mode: Mode): Note;
```

> **DECISION FLAGGED FOR USER REVIEW — Ionian & Aeolian.** Dorian/Phrygian/
> Lydian/Mixolydian/Locrian each have an unambiguous characteristic note (the
> altered degree vs the reference scale). Ionian *is* the major reference and
> Aeolian *is* the natural-minor reference, so they have no "altered" degree —
> the choice of what to highlight is a teaching judgment. Chosen: Ionian → maj7
> (its brightest identifier, distinguishes from Mixolydian); Aeolian → ♭6
> (distinguishes from Dorian). If you prefer different anchors (e.g. Ionian → P4
> "avoid note", or "no characteristic" for the two reference scales), say so and
> this single table changes. Everything else is derived from it.

Every mode note set still comes from `scaleNotes`; this only labels one degree.

---

## Audio layer

### `src/lib/audio/context.ts` (new — small refactor)

Extract the private `getCtx()` singleton currently in `pluck.ts` into a shared
module so drone, pitch, and sequencer reuse one `AudioContext`.

```ts
export function getAudioContext(): AudioContext | null; // moved verbatim from pluck.ts getCtx
```

`pluck.ts` imports `getAudioContext` and drops its local copy. No behaviour
change; existing pluck tests stay green.

### `src/lib/audio/drone.ts` (new)

A sustained tone with an explicit stop handle. `playPluck` is one-shot and
cannot sustain, so this is net-new.

```ts
export interface DroneHandle { stop(): void; }
// midi = absolute MIDI note. Low-gain triangle oscillator with short
// attack/release gain ramps to avoid clicks. Returns a no-op handle (stop()
// safe to call) when there is no AudioContext (headless/unsupported).
export function startDrone(midi: number): DroneHandle;
```

Drone pitch for a prompt: the root pitch-class placed in a low octave
(`midiForDrone(rootNote)` → e.g. octave 3). Gain ~0.07 so it sits under the
plucks. Body is responsible for `stop()` on prompt-complete, pause, abort, and
component teardown; starting a new drone stops the previous one.

### `src/lib/audio/sequence.ts` (new)

Play a list of positions in sequence (generalises `playInterval`).

```ts
export function playSequence(
  notes: Array<{ string: StringNum; fret: number }>,
  gapMs?: number // default 350
): void;
```

Refactor `playInterval` in `pluck.ts` to delegate to `playSequence` (two-note
case). One-line change; keeps the intervals exercise behaviour and its tests.

### `src/lib/audio/pitch.ts` (new — mic input)

Uses the **`pitchy`** dependency (McLeod Pitch Method; small, maintained) for
robust monophonic pitch detection.

```ts
export interface PitchListener { stop(): void; }

// Opens getUserMedia(audio), wires an AnalyserNode, and on each animation frame
// runs pitchy over the time-domain buffer. Converts Hz→MIDI and calls onNote
// ONLY when a note onset is accepted (see state machine). Rejects when the mic
// is denied/unavailable (promise rejects) so the body can fall back to click.
export function startPitchListener(
  onNote: (midi: number) => void,
  opts?: { clarityThreshold?: number; stableFrames?: number }
): Promise<PitchListener>;
```

**Pure, unit-tested helpers** (extracted so logic is testable without Web Audio
— jsdom has no real mic/AudioContext):

```ts
// src/lib/audio/pitchMath.ts
export function hzToMidi(hz: number): number;          // round(69 + 12*log2(hz/440))
export class OnsetDetector {                            // frame-by-frame acceptor
  // accept a new note when: clarity >= threshold, detected MIDI stable across
  // `stableFrames` consecutive frames, and the note differs from the last
  // accepted note OR a silence gap (clarity dropped) occurred since it. This
  // prevents a single sustained/noisy note from machine-gunning submissions.
  push(midi: number | null, clarity: number): number | null; // returns accepted midi or null
}
```

Defaults: `clarityThreshold = 0.9`, `stableFrames = 3`, `fftSize = 2048`.

---

## Config / type changes

### `PlayShapeConfig` (`src/lib/exercise/modes/types.ts`) — add

```ts
drone: boolean;                    // default false
highlightCharacteristic: boolean;  // default false
fixedRootNote: Note | null;        // null = random root (current behaviour)
inputMode: 'click' | 'mic';        // default 'click'; 'mic' only valid w/ octave+pitch
```

### `IdentifyModeConfig` — add

```ts
drone: boolean;                    // default false
highlightCharacteristic: boolean;  // default false; used on reveal
fixedRootNote: Note | null;        // null = random root
promptMode: 'visual' | 'audio';    // default 'visual'
```

No change to prompts, answers, reports, or `ModesReport`. Scoring/aggregation
untouched.

---

## Engine changes (minimal)

### `PlayShapeExercise`

- `getNextPrompt`: when `config.fixedRootNote` is set, constrain the root draw to
  positions whose note equals `fixedRootNote` (reject-sample string/fret ≤
  maxFret); randomise the mode only; avoid repeating the previous mode. When
  `null`, current behaviour. The existing octave/box reachability rejection still
  applies.
- **Mic requires no judging change.** The octave/pitch path already accepts any
  position with the expected absolute pitch (`pitchOf(answer) ===
  expectedPitches[stepIndex]`). The body, on an accepted detected MIDI, finds a
  position with that exact MIDI within maxFret and calls the existing
  `submitAnswer(pos)`. A detected pitch that doesn't match the expected step
  submits a mismatching position → scored wrong, exactly like a wrong click.

### `IdentifyModeExercise`

- `getNextPrompt`: same `fixedRootNote` handling as above.
- `promptMode` is **purely presentational** — the engine is identical for visual
  and audio prompts. No change beyond fixed-root.

---

## Component changes

### `Fretboard.svelte`

Add one `HighlightKind`: `'characteristic'`, with a distinct fill colour (reads
clearly in the existing palette, distinct from `scale-note`/`scale-root`/
`user-correct`). No other change.

### `PlayShapeBody.svelte`

- **Drone**: when `config.drone`, `startDrone(midiForDrone(prompt.rootNote))` on
  each new prompt; `stop()` on complete, pause (via SessionShell `paused`),
  abort, and teardown.
- **Characteristic highlight**: when `config.highlightCharacteristic`, add
  `'characteristic'` highlights for every shown position whose pitch-class ==
  `characteristicNote(prompt.rootNote, prompt.mode)`. (For octave, that's the
  characteristic step(s) in the run; for box, the characteristic tones in the
  window.) Purely additive to the derived highlight set.
- **Mic**: when `config.inputMode === 'mic'` (guaranteed octave+pitch by start
  screen validation), on mount start the pitch listener. Show a "🎤 listening…
  (last heard: <note>)" indicator in `headerExtra`. On each accepted MIDI, find
  a Pos with that MIDI ≤ maxFret and route through the existing `handleSelect`
  path (so lit/wrong/hint/advance logic is reused untouched). If the mic promise
  rejects (denied/unsupported), show a message and fall back to click input for
  the session. Stop the listener on teardown. Clicking still works as a fallback
  even in mic mode.

### `IdentifyModeBody.svelte`

- Import audio (fixes the current inconsistency where it ignores `playSound`).
- **Audio prompt**: when `config.promptMode === 'audio'`, on each new prompt play
  the mode's ascending scale via `playSequence(octaveFixedPositions(root, mode,
  maxFret))`; render the board **without** the scale highlights until an answer
  is given (root marker only, so it's an ear task). Add a "▶ Replay" button.
  When `'visual'`, current behaviour (and plucks are not auto-played).
- **Drone**: same as PlayShapeBody, keyed on `config.drone`.
- **Characteristic highlight on reveal**: when `config.highlightCharacteristic`,
  after an answer add `'characteristic'` highlights to the revealed board so the
  learner sees which note defined the mode.

### `SessionShell.svelte`

No change. Bodies already receive `paused` (bindable) and `onResume`; they use
`paused` to gate input and will also use it to pause/resume the drone.

### `StartScreen.svelte`

Within the existing `isModes` control block, add (following the chip/checkbox
pattern already there):

- **Root** (both): `Random` | `Fixed` chips; when Fixed, a note `<select>`
  (the 12 chromatic notes) → `fixedRootNote`.
- **Drone** (both): checkbox → `drone`.
- **Characteristic note** (both): checkbox → `highlightCharacteristic`.
- **Identify-mode only**: Prompt chips `See the notes` | `Hear the scale` →
  `promptMode`.
- **Play-shape only**: Input chips `Click` | `Play (mic)` → `inputMode`. The
  `Play (mic)` chip is **disabled** (greyed, with a hint) unless
  `shapeVariant === 'octave' && octaveJudge === 'pitch'`; selecting box or fixed
  while mic is active silently resets `inputMode` to `'click'`.

`valid` gains no new hard requirement (all defaults are valid); add the invariant
that `inputMode === 'mic'` implies octave+pitch (enforced by the reset above).

### `ReportScreen.svelte`

No change — `ModesReport` is unchanged.

---

## Routing / storage

### `hash.ts`

- play-shape serialize/parse: add `drone` (bool), `char` (bool), `root`
  (`'random'` or a chromatic note), `input` (`click`|`mic`). Validate `input`
  against octave+pitch; if invalid, fall back to `click`.
- identify-mode: add `drone`, `char`, `root`, `pmode` (`visual`|`audio`).
- All new params default to the current behaviour when absent, so existing URLs
  still parse. Invalid enum values fall back to the default (existing pattern).

### `prefs.ts`

Add optional fields (backward-compatible with stored v1, like the existing modes
fields):

```ts
drone?: boolean;
highlightCharacteristic?: boolean;
fixedRootNote?: Note | 'random';   // 'random' sentinel ↔ config null
inputMode?: 'click' | 'mic';
identifyPromptMode?: 'visual' | 'audio';
```

---

## Dependency

Add **`pitchy`** (runtime dependency). First runtime dep in the project (it has
only devDependencies today) — acceptable per the user ("I don't mind reasonable
dependencies"); robust pitch detection is exactly where a small lib earns its
place over a hand-rolled autocorrelation loop (octave-error/confidence handling
is the hard part). Pin a specific version.

---

## Testing (TDD)

Unit (vitest):
- `modes.test.ts`: `MODE_CHARACTERISTIC` offset for each mode; `characteristicNote`
  for several roots (e.g. C Lydian → F♯, C Dorian → A, C Mixolydian → B♭).
- `pitchMath.test.ts`: `hzToMidi` for 440→69, 880→81, 82.4→40 (low E);
  `OnsetDetector` — accepts a stable high-clarity note once, does not re-accept
  the same sustained note, re-accepts after a silence gap, rejects low-clarity.
- `PlayShapeExercise.test.ts`: fixed-root prompts always use `fixedRootNote`;
  mode still randomises; octave/pitch judging unchanged (regression).
- `IdentifyModeExercise.test.ts`: fixed-root prompts; `promptMode` does not alter
  engine output (visual and audio produce identical prompts/answers for a seeded
  draw).
- `hash.test.ts`: round-trip play-shape and identify-mode configs with every new
  param; legacy URLs (no new params) still parse to current defaults;
  `input=mic` with box/fixed falls back to click.
- `shape.ts`/`notes.ts`: existing coverage already exercises `octaveFixedPositions`
  and `pitchOf`; add a "find position for MIDI" helper test if a new helper is
  introduced for the mic path.

Component smoke (mirroring existing):
- StartScreen: shows the new modes controls; mic chip disabled unless octave+pitch;
  audio-prompt chip present for identify-mode.
- IdentifyModeBody: audio prompt hides scale highlights until answered; reveal
  shows characteristic highlight when enabled.
- PlayShapeBody: characteristic highlights appear when enabled.

Audio/mic modules (`drone.ts`, `sequence.ts`, `pitch.ts` Web-Audio parts) are not
unit-tested directly (no real AudioContext/mic in jsdom); they are thin and
null-guarded like `pluck.ts`, with all real logic pushed into the pure helpers
above. Manual verification on the live site covers the Web-Audio wiring.

---

## Rollout

Work on a `modes-sound` branch (git worktree). Two increments, each independently
usable and merged by the user:

1. **Drone + characteristic + parallel framing + audio prompt** — the no-new-dep,
   pure-Web-Audio features. Music data, `context.ts`/`drone.ts`/`sequence.ts`,
   config/engine/body/StartScreen/hash/prefs wiring, Fretboard kind.
2. **Mic input** — `pitchy` dep, `pitch.ts` + `pitchMath.ts`, PlayShapeBody mic
   path, StartScreen mic chip + validation, hash/prefs `input`.

Adversarial subagent review before each merge. After merge to `main`,
guitar.sheax0r.ca rebuilds; verify each feature loads and works on the live site
(drone sounds, characteristic highlights, fixed root, audio prompt plays, mic
detects and judges).

## Non-goals / YAGNI

- No new exercise type, no new mode beyond the existing 7.
- No chord/polyphonic detection, no standalone tuner, no mic calibration UI
  (clarity threshold + nearest-semitone snapping handles normal playing; a badly
  out-of-tune guitar is the user's to fix).
- No drone chords (root only), no configurable drone octave/timbre.
- No mic for box/fixed variants (positional, out of mic's reach).
- No change to Root Notes / Random Roots / Intervals.
