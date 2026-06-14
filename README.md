# Guitar Exercises

A local web app for guitar practice. Includes two exercises:

- **Root Notes** — given a fixed target note and a starting position on the fretboard, find the closest occurrence of that note on any string.
- **Random Roots** — same task, but the target note is re-randomized from A, E, or D on every prompt and shown each question.

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
    music/        # Note math, tuning, fretboard position helpers
    audio/        # Karplus-Strong pluck synthesis
    exercise/     # Exercise<...> interface and Root Notes implementation
    components/   # Svelte components (screens + Fretboard widget)
    storage/      # localStorage preferences wrapper
  App.svelte      # Screen router
```

## Adding another exercise type

1. Create a new directory under `src/lib/exercise/` (mirror `rootNotes/`).
2. Define your `Config`, `Prompt`, `Answer`, `Report` types.
3. Implement the `Exercise<Config, Prompt, Answer, Report>` interface.
4. Add a screen variant (or, when the second exercise lands, refactor `SessionScreen` to accept an exercise-supplied main view).
5. Add a selector option in `StartScreen`.
