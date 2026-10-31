# Modes Sound & Ear Additions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five opt-in sound/ear features to the two mode exercises: drone, characteristic-note highlight, parallel (fixed-root) framing, audio prompt for Identify the Mode, and mic pitch-detection input for Play the Shape.

**Architecture:** Reuse the existing Svelte 5 + vitest app. Extract one shared `AudioContext` getter, add three thin Web-Audio helpers (drone, sequence, pitch-via-pitchy) and one pure music table (characteristic note). Wire opt-in config fields through types → engine (fixed-root only) → bodies → StartScreen → hash → prefs. Mic maps to the existing octave/pitch judging path (detected pitch → matching `Pos` → `submitAnswer`), so the engine barely changes.

**Tech Stack:** TypeScript, Svelte 5 (runes), Vite, vitest, Web Audio API, `pitchy` (new runtime dep, McLeod pitch detection).

**Spec:** `docs/superpowers/specs/2026-10-15-modes-sound-exercises-design.md`

## Global Constraints

- All five features are **opt-in**; defaults reproduce current behaviour exactly. Existing Root Notes / Random Roots / Intervals untouched.
- No new exercise *type*; no mode beyond the existing 7.
- Mic input valid **only** when `shapeVariant === 'octave' && octaveJudge === 'pitch'`.
- New URL/prefs params must default to current behaviour when absent (existing URLs still parse). Invalid enum → default.
- Web-Audio/mic modules must be null-guarded and no-op headless (match `pluck.ts`). All real logic goes in pure helpers that vitest can run in jsdom.
- `pitchy` pinned to an exact version.
- Commit messages end with the session attribution footer (see repo convention).

## Review Focus

- **Mic permission denied / no mic / insecure context** → `startPitchListener` promise rejects; PlayShapeBody must show a message and fall back to click input, never hang or throw. (Task 14/16)
- **Noisy or sustained mic signal** → a single held/ringing note must not machine-gun multiple submissions; `OnsetDetector` accepts once per onset. (Task 13)
- **Fixed root with a mode whose octave shape is unreachable at low maxFret** → `getNextPrompt` must still terminate (bounded retries) and not infinite-loop when the root is constrained. (Task 7)
- **Legacy URL / prefs with no new params** → parse to current defaults; `input=mic` persisted but variant later changed to box → coerced to click. (Task 8/9/10)
- **Drone left running** → switching prompt, pausing, aborting, or unmounting must stop the previous drone (no stuck oscillator). (Task 3/11/12)

---

## Increment 1 — Web-Audio features (no new dependency)

### Task 1: Extract shared AudioContext

**Files:**
- Create: `src/lib/audio/context.ts`
- Modify: `src/lib/audio/pluck.ts` (remove local `getCtx`, import shared)
- Test: covered by existing `pluck.test.ts` (regression)

**Produces:** `getAudioContext(): AudioContext | null`

- [ ] Move the `ctx`/`ctxFailed`/`getCtx` singleton from `pluck.ts` verbatim into `context.ts`, exported as `getAudioContext`.
- [ ] `pluck.ts`: `import { getAudioContext } from './context'`; replace `getCtx()` calls.
- [ ] Run `npm test -- pluck` — expect PASS (no behaviour change).
- [ ] Commit.

### Task 2: Characteristic-note data (pure)

**Files:**
- Modify: `src/lib/music/modes.ts`
- Test: `src/lib/music/modes.test.ts`

**Produces:** `MODE_CHARACTERISTIC: Record<Mode, number>`, `characteristicNote(root: Note, mode: Mode): Note`

- [ ] Write failing tests:
```ts
import { MODE_CHARACTERISTIC, characteristicNote } from './modes';
test('characteristic offsets', () => {
  expect(MODE_CHARACTERISTIC.lydian).toBe(6);
  expect(MODE_CHARACTERISTIC.dorian).toBe(9);
  expect(MODE_CHARACTERISTIC.mixolydian).toBe(10);
  expect(MODE_CHARACTERISTIC.phrygian).toBe(1);
  expect(MODE_CHARACTERISTIC.locrian).toBe(6);
});
test('characteristicNote maps through root', () => {
  expect(characteristicNote('C', 'lydian')).toBe('F#');
  expect(characteristicNote('C', 'dorian')).toBe('A');
  expect(characteristicNote('C', 'mixolydian')).toBe('A#'); // Bb
});
```
- [ ] Run — expect FAIL (not exported).
- [ ] Implement: add the `MODE_CHARACTERISTIC` table from the spec and `characteristicNote` = `CHROMATIC[(indexOf(root)+offset)%12]`.
- [ ] Run — expect PASS. Commit.

### Task 3: Drone helper

**Files:**
- Create: `src/lib/audio/drone.ts`
- Test: `src/lib/audio/drone.test.ts` (headless smoke: returns a handle whose `stop()` does not throw when no AudioContext)

**Consumes:** `getAudioContext` (Task 1)
**Produces:** `DroneHandle { stop(): void }`, `startDrone(midi: number): DroneHandle`, `midiForDrone(note: Note): number`

- [ ] Write failing smoke test: `startDrone(45).stop()` does not throw in jsdom (no AudioContext → no-op handle); `midiForDrone('E')` returns a MIDI in octave 3 range (48–59 pitch-class E → 52).
- [ ] Implement: `midiForDrone(note)` = `CHROMATIC.indexOf(note) + 48` (octave 3). `startDrone(midi)`: `ctx = getAudioContext()`; if null return `{ stop(){} }`. Resume if suspended. Create `OscillatorNode` (`type='triangle'`, freq `440*2^((midi-69)/12)`) → `GainNode` (ramp to 0.07 over 20ms) → destination; `osc.start()`. Return `{ stop }` that ramps gain to 0 over 40ms then `osc.stop()` (guarded try/catch).
- [ ] Run — expect PASS. Commit.

### Task 4: Sequence helper + playInterval delegation

**Files:**
- Create: `src/lib/audio/sequence.ts`
- Modify: `src/lib/audio/pluck.ts` (`playInterval` delegates)
- Test: `src/lib/audio/sequence.test.ts` (smoke: `playSequence([])` and a 2-note list do not throw headless); existing `pluck.test.ts` regression for `playInterval`

**Consumes:** `playPluck` (existing)
**Produces:** `playSequence(notes: Array<{string: StringNum; fret: number}>, gapMs?: number): void`

- [ ] Write failing smoke test for `playSequence`.
- [ ] Implement: schedule `playPluck` for each note at `i*gapMs` via `setTimeout` (gapMs default 350). Empty list → no-op.
- [ ] Refactor `playInterval(first, second, gapMs=450)` → `playSequence([first, second], gapMs)`.
- [ ] Run `npm test -- pluck sequence` — expect PASS. Commit.

### Task 5: Fretboard `'characteristic'` highlight kind

**Files:**
- Modify: `src/lib/components/Fretboard.svelte` (HighlightKind union + `highlightFill`)
- Test: `src/lib/components/Fretboard.test.ts`

**Produces:** `HighlightKind` includes `'characteristic'`

- [ ] Add `'characteristic'` to the `HighlightKind` union (`<script module>`).
- [ ] Add a distinct fill in `highlightFill` (e.g. amber `#f59e0b`), distinct from scale-note/scale-root/user-correct.
- [ ] Add/extend a test asserting a `'characteristic'` highlight renders a circle with the chosen fill.
- [ ] Run — expect PASS. Commit.

### Task 6: Config & type additions

**Files:**
- Modify: `src/lib/exercise/modes/types.ts`
- Test: type-level (compile) + used by later tasks

**Produces:** extended `PlayShapeConfig` (`drone`, `highlightCharacteristic`, `fixedRootNote: Note|null`, `inputMode: 'click'|'mic'`) and `IdentifyModeConfig` (`drone`, `highlightCharacteristic`, `fixedRootNote: Note|null`, `promptMode: 'visual'|'audio'`).

- [ ] Add the fields (from spec) to both interfaces. Import `Note`.
- [ ] Run `npm run check` — expect type errors in StartScreen/hash/prefs/bodies where configs are built (fixed in later tasks). This task's own deliverable is the type; downstream tasks satisfy it. (Do not commit until downstream compiles — fold commit into Task 10, or temporarily add defaults. Prefer: add fields, then immediately do Tasks 7–10 before `npm run check` is clean, committing the group.)

> Note: Task 6 has no standalone green state (adding required config fields breaks every config builder). Implement Tasks 6→10 as one commit group, each with its own tests, committing once `npm run check` + tests are green.

### Task 7: Engine — fixed-root support

**Files:**
- Modify: `src/lib/exercise/modes/PlayShapeExercise.ts`, `src/lib/exercise/modes/IdentifyModeExercise.ts`
- Test: `PlayShapeExercise.test.ts`, `IdentifyModeExercise.test.ts`

**Consumes:** `PlayShapeConfig.fixedRootNote`, `IdentifyModeConfig.fixedRootNote` (Task 6); `noteAt`, `allPositionsOf`
**Produces:** both `getNextPrompt` honour a fixed root.

- [ ] Write failing tests:
```ts
test('fixed root: every prompt uses the configured root note', () => {
  const ex = new PlayShapeExercise();
  ex.start({ ...basePlayShape, fixedRootNote: 'G', shapeVariant: 'octave', octaveJudge: 'pitch' });
  for (let i = 0; i < 30; i++) {
    const p = ex.getNextPrompt();
    expect(p.rootNote).toBe('G');
  }
});
```
(and the analogous IdentifyMode test)
- [ ] Run — expect FAIL.
- [ ] Implement: in each `getNextPrompt`, when `fixedRootNote` is non-null, draw the root position from `allPositionsOf(fixedRootNote, maxFret)` (random element, ≤ maxFret) instead of a random string/fret; when choosing what not to repeat, compare mode only (root is constant). Keep the bounded `MAX_ATTEMPTS` retry for octave/box reachability; if a fixed root yields no reachable octave shape within maxFret for the drawn mode, retry a different mode (bounded).
- [ ] Run — expect PASS.

### Task 8: Routing — new hash params

**Files:**
- Modify: `src/lib/routing/hash.ts`
- Test: `src/lib/routing/hash.test.ts`

**Consumes:** extended configs (Task 6)
**Produces:** play-shape hash carries `drone,char,root,input`; identify-mode carries `drone,char,root,pmode`.

- [ ] Write failing round-trip tests for both exercises including all new params; a legacy URL (no new params) parses with defaults (`drone=false`, `char=false`, `fixedRootNote=null`, `inputMode='click'`, `promptMode='visual'`); `input=mic` with `variant=box` → `click`.
- [ ] Run — expect FAIL.
- [ ] Implement serialize/parse: `drone`/`char` via `parseBool`; `root` = `'random'` ↔ `null` else validated against `VALID_MODES`? No — against `CHROMATIC`; add a `parseNote`/validate. `input` validated to `click|mic` then coerced to `click` unless octave+pitch. `pmode` validated `visual|audio`.
- [ ] Run — expect PASS.

### Task 9: Storage — prefs fields

**Files:**
- Modify: `src/lib/storage/prefs.ts`
- Test: `src/lib/storage/prefs.test.ts`

**Produces:** optional prefs `drone`, `highlightCharacteristic`, `fixedRootNote: Note|'random'`, `inputMode`, `identifyPromptMode`.

- [ ] Add optional fields to `Prefs`. Write a test that a legacy blob without them `loadPrefs()`s fine and save/load round-trips the new fields.
- [ ] Run — expect PASS.

### Task 10: StartScreen controls

**Files:**
- Modify: `src/lib/components/StartScreen.svelte`
- Test: `src/lib/components/StartScreen.test.ts`

**Consumes:** Tasks 6, 8, 9
**Produces:** UI + config wiring for drone, characteristic, fixed root, identify prompt mode, play-shape input (mic chip gated). Commit the Task 6–10 group here.

- [ ] Write failing smoke tests: modes block shows Drone + Characteristic checkboxes and Root Random/Fixed; identify-mode shows `See the notes`/`Hear the scale`; play-shape shows `Click`/`Play (mic)` with mic disabled unless octave+pitch.
- [ ] Run — expect FAIL.
- [ ] Implement: `$state` for `drone`, `highlightCharacteristic`, `fixedRootNote` (`'random'`|Note), `inputMode`, `identifyPromptMode`, seeded from `loadPrefs()`. Add controls in the `isModes` block. Add an effect: if `inputMode==='mic'` and not (octave+pitch), reset to `'click'`. Build the new fields into both config objects in `handleStart` (map `'random'`→`null` for `fixedRootNote`) and into the saved `Prefs`.
- [ ] Run `npm run check` + `npm test` — expect PASS. Commit the 6–10 group.

### Task 11: PlayShapeBody — drone + characteristic

**Files:**
- Modify: `src/lib/components/PlayShapeBody.svelte`
- Test: `src/lib/components/SessionScreen.test.ts` or a PlayShapeBody smoke test

**Consumes:** `startDrone`/`midiForDrone` (T3), `characteristicNote` (T2), `'characteristic'` kind (T5)
**Produces:** drone lifecycle + characteristic highlights on the board.

- [ ] Write failing test: with `highlightCharacteristic: true`, the derived highlights include a `'characteristic'` entry at a position whose note equals `characteristicNote(root, mode)`.
- [ ] Run — expect FAIL.
- [ ] Implement: on new prompt, if `config.drone` start drone (`startDrone(midiForDrone(prompt.rootNote))`), stopping any previous handle; stop on complete, on `paused` true, on abort, and in an `onDestroy`/effect cleanup. When `config.highlightCharacteristic`, append `'characteristic'` highlights for shown positions whose pitch-class === characteristic. Guard drone start in try/catch.
- [ ] Run — expect PASS. Commit.

### Task 12: IdentifyModeBody — audio prompt + drone + characteristic reveal

**Files:**
- Modify: `src/lib/components/IdentifyModeBody.svelte`
- Test: smoke test

**Consumes:** `playSequence` (T4), `octaveFixedPositions` (existing), `startDrone` (T3), `characteristicNote` (T2), `'characteristic'` kind (T5)
**Produces:** ear-prompt variant, drone, reveal characteristic.

- [ ] Write failing tests: with `promptMode:'audio'`, scale highlights are hidden until an answer (only root marker shown); a `Replay` button exists. With `highlightCharacteristic:true`, after answering, `'characteristic'` highlights appear.
- [ ] Run — expect FAIL.
- [ ] Implement: import audio. On new prompt: if `promptMode==='audio'` and (`playSound` || audio prompt always sounds), `playSequence(octaveFixedPositions(prompt.root, prompt.mode, config.maxFret) ?? [])`; hide scale highlights (derive empty scale set, keep root marker) until `answered`. Add `Replay` button calling the same play. Drone lifecycle as in Task 11. After an answer, if `highlightCharacteristic`, add `'characteristic'` highlights.
- [ ] Run — expect PASS. Commit.

### Increment 1 adversarial review

- [ ] Dispatch a fresh adversarial reviewer subagent over the Increment-1 diff (correctness, lifecycle leaks, defaults-preserve-old-behaviour, type consistency, the Review Focus items that apply). Fix confirmed findings. Then the user merges Increment 1.

---

## Increment 2 — Mic input (adds `pitchy`)

### Task 13: Pitch math + onset detector (pure)

**Files:**
- Create: `src/lib/audio/pitchMath.ts`
- Test: `src/lib/audio/pitchMath.test.ts`

**Produces:** `hzToMidi(hz: number): number`, `class OnsetDetector { constructor(opts?: {clarityThreshold?: number; stableFrames?: number}); push(midi: number|null, clarity: number): number|null }`

- [ ] Write failing tests:
```ts
test('hzToMidi', () => {
  expect(hzToMidi(440)).toBe(69);
  expect(hzToMidi(880)).toBe(81);
  expect(hzToMidi(82.41)).toBe(40); // low E
});
test('OnsetDetector accepts once per onset', () => {
  const d = new OnsetDetector({ clarityThreshold: 0.9, stableFrames: 3 });
  expect(d.push(60, 0.95)).toBeNull();      // frame 1
  expect(d.push(60, 0.95)).toBeNull();      // frame 2
  expect(d.push(60, 0.95)).toBe(60);        // frame 3 → accept
  expect(d.push(60, 0.95)).toBeNull();      // still held → no re-accept
  d.push(null, 0.1);                        // silence gap
  expect(d.push(60, 0.95)); // after gap + stable → may accept again (assert accepts on 3rd stable)
});
test('rejects low clarity', () => {
  const d = new OnsetDetector();
  expect(d.push(60, 0.3)).toBeNull();
});
```
- [ ] Run — expect FAIL.
- [ ] Implement `hzToMidi` = `Math.round(69 + 12*Math.log2(hz/440))`. `OnsetDetector`: track `lastAccepted`, `candidate`, `candidateCount`, `sawSilence`. On `push(midi, clarity)`: if `clarity < threshold || midi==null` → mark `sawSilence=true`, reset candidate, return null. Else if `midi===candidate` increment count else set candidate=midi,count=1. When count>=stableFrames and (midi!==lastAccepted || sawSilence): set lastAccepted=midi, sawSilence=false, return midi. Else null.
- [ ] Run — expect PASS. Commit.

### Task 14: Pitch listener (Web Audio + pitchy)

**Files:**
- Modify: `package.json` (add `pitchy`), `package-lock.json`
- Create: `src/lib/audio/pitch.ts`
- Test: smoke only (jsdom has no getUserMedia) — assert the module imports and `startPitchListener` returns a promise that rejects cleanly when `navigator.mediaDevices` is absent.

**Consumes:** `getAudioContext` (T1), `hzToMidi` + `OnsetDetector` (T13), `pitchy`
**Produces:** `startPitchListener(onNote: (midi: number)=>void, opts?): Promise<{stop(): void}>`

- [ ] `npm install pitchy@<pinned>`; confirm it's in `dependencies`.
- [ ] Write failing smoke test: in jsdom (`navigator.mediaDevices` undefined), `await expect(startPitchListener(()=>{})).rejects` (or returns rejects) — no throw synchronously.
- [ ] Run — expect FAIL.
- [ ] Implement: if no `navigator.mediaDevices?.getUserMedia` → `return Promise.reject(new Error('mic unavailable'))`. Else `getUserMedia({audio:true})`, create source from `getAudioContext()`, `AnalyserNode` (`fftSize=2048`), `PitchDetector.forFloat32Array(analyser.fftSize)` from pitchy, a `Float32Array` buffer, an rAF loop: `analyser.getFloatTimeDomainData(buf)`, `[hz, clarity] = detector.findPitch(buf, sampleRate)`, feed `OnsetDetector.push(hzToMidi(hz), clarity)`; on accept call `onNote(midi)`. `stop()` cancels rAF, stops tracks, disconnects.
- [ ] Run — expect PASS. Commit.

### Task 15: PlayShapeBody mic path + StartScreen mic enablement

**Files:**
- Modify: `src/lib/components/PlayShapeBody.svelte`, `src/lib/components/StartScreen.svelte`
- Test: PlayShapeBody/StartScreen smoke

**Consumes:** `startPitchListener` (T14), `pitchOf`/`allPositionsOf` (existing), `inputMode` config (T6), StartScreen mic chip (T10)
**Produces:** mic-driven answering for octave/pitch.

- [ ] Write failing test: with `inputMode:'mic'`, the body shows a listening indicator; a simulated accepted MIDI matching the expected next pitch advances the step (inject a fake `onNote` by stubbing `startPitchListener`, or test the pitch→Pos→submit helper directly).
- [ ] Run — expect FAIL.
- [ ] Implement: a small pure helper `posForMidi(midi, maxFret): Pos | null` (first `allPositionsOf` whose `pitchOf===midi`); on `onNote(midi)`, if a matching Pos exists route it through the existing `handleSelect(pos)`; else ignore. Start the listener on mount when `inputMode==='mic'`; on reject show "mic unavailable — using clicks" and leave click handling active. Indicator in `headerExtra`: "🎤 listening… (<lastNote>)". Stop listener on destroy. StartScreen: already has the gated chip from Task 10 — verify the disable logic ships. Clicking still works in mic mode.
- [ ] Run `npm run check` + `npm test` — expect PASS. Commit.

### Increment 2 adversarial review

- [ ] Fresh adversarial reviewer over the Increment-2 diff (mic lifecycle/leak, permission-reject fallback, onset correctness, pitch→Pos mapping, no regression to click mode). Fix confirmed findings.

---

## Ship

- [ ] Full `npm run check` + `npm test` + `npm run build` green on the branch.
- [ ] Whole-branch adversarial review (fresh reviewer, most-capable model).
- [ ] User merges to `main`; guitar.sheax0r.ca rebuilds.
- [ ] Verify live: drone sounds under a prompt; characteristic highlight appears; fixed root holds; identify audio prompt plays + replay; mic detects a played note and advances. Report results.

## Self-review notes

- Spec coverage: all five features + context extract + Fretboard kind + hash/prefs/StartScreen + tests mapped to tasks. ✔
- Task 6 has no standalone green state (required config fields) → explicitly grouped with 7–10 into one commit. ✔
- Type consistency: `fixedRootNote: Note|null` in config; `'random'` sentinel only in prefs/hash, mapped at the StartScreen boundary. `inputMode`/`promptMode`/`drone`/`highlightCharacteristic` names consistent across types/hash/prefs/bodies. ✔
- Review Focus items each pinned to an owning task (14/16, 13, 7, 8/9/10, 3/11/12). ✔
