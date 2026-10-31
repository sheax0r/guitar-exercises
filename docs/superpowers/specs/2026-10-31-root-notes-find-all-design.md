# Root Notes "Find All" — Design

Date: 2026-10-31
Status: shipped. Item 6 of `2026-10-31-improvisation-roadmap-design.md`.

## Goal

Train octave shapes directly: find every occurrence of the target note, not
just the nearest one, against the clock.

## Behaviour

- Root Notes (fixed target, or A/E/D re-drawn per prompt) gains a drill choice:
  `rootVariant: 'nearest'` (the original, default) or `'find-all'`.
- `findAllWindow`:
  - `neck`: every occurrence from fret 0 to `maxFret`.
  - `window`: a random 5-fret window (`FIND_ALL_SPAN`) inside `maxFret`,
    re-drawn per prompt; the header says "Find every A in frets 5–9". The
    window is not shaded on the board (the fretboard has no window overlay);
    the fret range in the header plus fret numbers is enough.
- Clicks in any order. A click on a non-target or already-found position is
  wrong and marks the prompt incorrect. The prompt completes when every
  occurrence is found. "Show the rest" gives up: the missed positions are shown
  and the prompt counts as incorrect.
- The clock is the session timer (fixed duration or continuous); per-prompt
  time is recorded for the report.
- "Show all labels" and "Show root note positions" are hidden for find-all
  (they would give the answer away); the closest-position algorithm doesn't
  apply either but stays in "More options" for the shared card.

## Engine and UI

- `exercise/FindAllExercise.ts` implements `Exercise<ExerciseConfig, …,
  ExerciseReport>`, so the existing Root Notes report (heatmap + weakest spots)
  is reused. Totals are per prompt; each heatmap position is scored by whether
  its prompt was clean and how long it took to find (missed positions count as
  misses).
- `components/FindAllBody.svelte` uses `SessionShell` like the CAGED and modes
  bodies; `SessionScreen` routes Root Notes to it when `rootVariant` is
  `find-all`.
- The config fields are optional on `ExerciseConfig` (absent = nearest), so
  Intervals configs and old stored configs are unaffected.
- URL: `rvar=nearest|all`, `win=neck|window` on Root Notes hashes only; old
  URLs and recents parse as the nearest drill.

## Deferred

- Mic input (a heard pitch can't say which of several positions was played).
- Configurable window width.
