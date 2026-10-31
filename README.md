# Guitar Exercises

A local web app for guitar practice. The entry page (`#/`) leads to two sections:
**Learn** (`#/learn`, the exercises below) and **Ideate** (`#/ideate`, a placeholder for the
Whistler melody-to-tab tool; see `docs/superpowers/plans/2026-10-31-whistler-integration.md`).

Exercises:

- **Root Notes** — from a starting position, find the nearest occurrence of a target note; the A/E/D option re-picks the target from A, E or D each prompt.
- **Intervals** — find the 3rd or 5th above a note, in a major or minor key.
- **Play the Shape** — play a mode as a one-octave run or position box, by clicking or into a mic.
- **Identify the Mode** — name the mode from its notes on the fretboard or its sound.
- **CAGED Shapes** — find a chord's tones inside a C/A/G/E/D shape (click or mic), name a shape, or play the next shape up the neck.

## Run it

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

## Test

```bash
npm test
```

### Ideate transcription tests (dev only)

A browser harness scores the transcription pipeline (`src/lib/transcribe/`) against real audio:

```bash
python3 -I test/fetch_fixtures.py   # ~7.7 MB into test/fixtures/ (gitignored)
npm run dev                         # then open /ideate-test.html
```

`?engines=pitchy`, `?engines=ai` or `?engines=learn` runs one engine (`learn` replays the GuitarSet
takes through Learn's live mic judging and checks the annotated notes are heard; the same check runs in
`npm test` when the fixtures are present and skips otherwise); `?only=hb-` filters fixtures. Missing fixtures
SKIP. The synthetic fixtures also run in `npm test`. Licenses: `test/fixtures/ATTRIBUTION.md`.

## Build

```bash
npm run build
```

Output goes to `dist/`. Serve those files from any static host.

## Architecture

See [`docs/superpowers/specs/2026-05-18-guitar-exercises-root-notes-design.md`](docs/superpowers/specs/2026-05-18-guitar-exercises-root-notes-design.md) for the full design.

Quick layout:

```
src/
  lib/
    music/        # Note math, tuning, scales, modes, fretboard position helpers
    audio/        # Pluck synthesis, drone, mic pitch detection, metronome, latency calibration
    transcribe/   # Ideate: audio -> notes -> tab -> .gp (ported from Whistler)
    ideate/       # Ideate UI: recorder, jobs queue, cleanup panel, calibration
    exercise/     # Exercise<...> interface, fretboard exercises, config summary
      modes/      # Play the Shape and Identify the Mode
      caged/      # CAGED Shapes
    components/   # Svelte screens + Fretboard widget
      start/      # Start-screen pickers and per-exercise settings
    routing/      # URL hash <-> session config
    storage/      # localStorage preferences and recent sessions
  App.svelte      # Screen router
```

## Adding another exercise type

1. Implement the exercise under `src/lib/exercise/` (mirror `modes/`): config, prompt, answer and report types plus the `Exercise<...>` interface; add the config to `AnyConfig`.
2. Add a settings component in `src/lib/components/start/` (mirror `IntervalsSettings.svelte`).
3. Add a card entry in `StartScreen`'s `CARD_GROUPS`, render the settings component, and build the config in `buildConfig`.
4. Parse and serialize the config in `src/lib/routing/hash.ts`, and add its summary in `src/lib/exercise/summary.ts`.
