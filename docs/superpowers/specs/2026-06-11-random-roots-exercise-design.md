# Random Roots exercise — design

**Date:** 2026-06-11
**Status:** Approved, pending implementation

## Summary

Add a second exercise, **Random Roots**, that is identical to the existing
**Root Notes** exercise except that the target note is re-randomized from a
fixed set **{A, E, D}** on every prompt (and shown in the header each
question) instead of being fixed for the whole session.

The player still finds the closest position of the displayed target note
relative to the highlighted random position. All the substantive machinery —
closest-position math, the fretboard widget, scoring, the heatmap, and the
report — is reused unchanged.

## Approach

The two exercises differ only in how the per-prompt target note is chosen.
Rather than duplicate the ~150-line `RootNotesExercise` class, we
**parameterize the existing engine** with a config discriminator. The target
note travels with each prompt.

Alternatives considered and rejected:

- **Separate `randomRoots/` exercise class** — duplicates `submitAnswer`,
  `getReport`, `notifyResumed`, and the report-aggregation logic, which then
  drift apart over time.
- **Full exercise-agnostic `SessionScreen` refactor** — overkill for two
  near-identical exercises; violates YAGNI.

## Changes by file

### `src/lib/exercise/rootNotes/types.ts`
- Add `exercise: 'root-notes' | 'random-roots'` to `RootNotesConfig`.
- Add `targetNote: Note` to `RootNotesPrompt` — the target now travels with
  each prompt rather than being read from config.

### `src/lib/exercise/rootNotes/RootNotesExercise.ts`
- `getNextPrompt()` chooses the target via a small private `pickTarget()`
  helper:
  - `root-notes` → `config.targetNote` (unchanged behavior).
  - `random-roots` → a uniformly random member of the hardcoded
    `RANDOM_ROOT_NOTES = ['A', 'E', 'D']`.
- The chosen target is stored on `prompt.targetNote` and fed into
  `closestPositionOf`.
- The existing "don't repeat the exact same highlighted position" guard is
  retained as-is. No guard against repeating a target note — acceptable
  (YAGNI); there are only three.
- Per-target report aggregation already keys off the correct *position*, and
  each fretboard position plays exactly one note, so `getReport` works
  unchanged for both exercises.

### `src/lib/components/SessionScreen.svelte`
- Read the target from `currentPrompt.targetNote` instead of
  `config.targetNote` in all four spots:
  1. Header `Target: {…}` display.
  2. `targetHighlightNote` prop passed to `<Fretboard>`.
  3. + 4. The two uses in the wrong-answer feedback branch
     (`clickedNote === target` check and the `closestPositionOf(target, …)`
     "closest from click" highlight).
- Result: the header target updates per prompt, and "Show roots" highlights
  the current prompt's target across the board.

### `src/lib/components/ReportScreen.svelte`
- Heatmap note label: derive from `noteAt(s.position.string, s.position.fret)`
  instead of the single global `targetNote`. This is equivalent for
  `root-notes` (all answer positions play the same note) and correct for
  `random-roots`.
- Title and heatmap caption: show `target note: {targetNote}` for
  `root-notes`; show `Random roots (A, E, D)` for `random-roots`.
- `buildTextReport()` title line gets the same conditional treatment.

### `src/lib/components/StartScreen.svelte`
- Enable the currently-disabled Exercise `<select>`; bind it to a new
  `exercise` state with options "Root Notes" (`root-notes`) and
  "Random Roots" (`random-roots`).
- When `random-roots` is selected, hide the "Root note" picker and show a
  static line: "Targets: A, E, D (randomized each prompt)".
- Include `exercise` in the saved `Prefs` and the emitted `RootNotesConfig`.

### `src/lib/routing/hash.ts`
- Add an `ex` query param. `parseHash` defaults a missing `ex` to
  `root-notes`, so existing/shared session URLs still parse.
- When `ex === 'random-roots'`, skip the `note` validation/requirement (no
  fixed target); set `config.targetNote` to a harmless default (e.g. `'A'`),
  which the random engine ignores.
- `sessionHash` writes the `ex` param. For `random-roots` the `note` param may
  be omitted or written but is ignored on parse.

### `src/lib/storage/prefs.ts`
- Add `exercise: 'root-notes' | 'random-roots'` to the `Prefs` interface so
  the selection persists across visits. `loadPrefs` already returns
  `Partial<Prefs>`, so older stored blobs without the field are handled by the
  `?? 'root-notes'` default in `StartScreen`.

## Testing

- **`RootNotesExercise.test.ts`** — extend:
  - With `exercise: 'random-roots'`, every prompt's `targetNote` is drawn only
    from `{A, E, D}`.
  - The prompt carries its `targetNote`, and `submitAnswer` accepts the closest
    position computed against *that* prompt's target.
  - Existing `root-notes` behavior unchanged (target equals `config.targetNote`).
- **`hash.test.ts`** — extend:
  - `ex` round-trips for both exercises.
  - A hash with no `ex` param parses as `root-notes` (back-compat).
  - A `random-roots` hash parses even when `note` is absent/invalid.

## Out of scope

- User-configurable target sets (fixed to A/E/D per product decision).
- Avoiding consecutive repeats of the same target note.
- Any change to the closest-position algorithms or scoring.
