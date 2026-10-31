# Guitar Exercises

A local web app for guitar practice. The entry page (`#/`) leads to two sections:
**Learn** (`#/learn`, the exercises below) and **Ideate** (`#/ideate`, a placeholder for the
Whistler melody-to-tab tool; see `docs/superpowers/plans/2026-10-31-whistler-integration.md`).

Exercises:

- **Root Notes** — from a starting position, find the nearest occurrence of a target note; the A/E/D option re-picks the target from A, E or D each prompt.
- **Intervals** — find the 3rd or 5th above a note, in a major or minor key.
- **Play the Shape** — play a mode as a one-octave run or position box, by clicking or into a mic.
- **Identify the Mode** — name the mode from its notes on the fretboard or its sound.

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
    audio/        # Pluck synthesis, drone, mic pitch detection
    exercise/     # Exercise<...> interface, fretboard exercises, config summary
      modes/      # Play the Shape and Identify the Mode
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
