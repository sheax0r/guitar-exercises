# Whistler Integration — Plan

Date: 2026-10-31
Status: proposed. Needs user sign-off on the open decisions at the bottom
before Phase 1.

## Goal

Fold Whistler (`~/git/whistler`: whistle, hum, sing or play into the mic and
get a Guitar Pro tab) into this app as a second section. The app becomes:

- **Learn**: the current exercises.
- **Ideate**: Whistler. Capture a melody, then turn it into a tab.

An entry page lets you choose a section, and a persistent nav switches between
them. Whistler's audio pipeline then becomes shared infrastructure for
exercises that *hear* the guitar.

**Hard constraint: frontend-only.** No server, no backend storage. The
deployment stays a static `dist/`.

## What Whistler is today (investigated)

- **Stack:** static `index.html`, `app.js` (~470 dense lines, 28 KB) and
  `core.js` (~230 lines, 15 KB). Vanilla JS ES modules, no build step.
  `serve.py` is only `python -m http.server` with no-cache headers.
- **Already frontend-only:**
  - All processing runs in the browser.
  - Persistence is IndexedDB (the job queue) plus `localStorage`
    (`whistler.calib`).
  - Demucs runs single-threaded on purpose, so it doesn't need
    `SharedArrayBuffer` or COOP/COEP headers. Any static host works.
- **`core.js` is the pure pipeline,** and it is cleanly exported:
  - `detectNotes`: pitchy, monophonic, with onset segmentation
  - `basicPitchNotes`: Spotify Basic Pitch, TF.js, **polyphonic**
  - `estimateLag`: latency calibration against a click track
  - `mapNotes`, `midiToFret`, `chordFrets`: pitch to fretting, using
    hand-movement-aware "nearest to previous" fretting
  - `toSixteenths` and others: quantize to a beat grid
  - `buildTex`, `buildScore`, `exportScore`: alphaTab score and `.gp` export
- **`app.js` is the UI:** about 56 DOM ids. It handles the recorder with
  metronome and count-in, the live tuner (cents), the job queue, the cleanup
  panel, waveform region select, latency calibration and source separation.
- **Dependencies (all loaded from jsDelivr):**

  | Library | Version | How it loads |
  |---|---|---|
  | pitchy | 4.1.0 | ESM |
  | fflate | 0.8.2 | ESM |
  | alphaTab | 1.8.4 | global `<script>` plus soundfont URL |
  | @spotify/basic-pitch | 1.0.1 | lazy, ~1 MB model |
  | onnxruntime-web and demucs-web | — | lazy, ~172 MB model, cached |

- **Tests:** a browser page at `test/` scores the real pipeline against
  fixtures (7.7 MB: GuitarSet, vocadito, a CC0 whistle clip). The fixtures are
  CC BY 4.0 and CC0, with `ATTRIBUTION.md`.

**Compatibility with this app:**

- Both apps use **pitchy 4.1.0**.
- Both have onset detection: `pitchMath.ts` `OnsetDetector` here, and the onset
  logic in `detectNotes` in Whistler.
- Both have a mic device picker and dark-mode CSS tokens.
- This app is Svelte 5, TypeScript and Vite, with hash routing (`#/`,
  `#/session?...`). Whistler has no routing.

## Target shape

```
#/                 entry page: two big cards, Learn / Ideate
#/learn            current StartScreen (today's #/)
#/learn/session?…  current session routes (today's #/session?…)
#/ideate           Whistler
```

- **Top nav:** a small `Learn | Ideate` switcher in a header bar on every
  screen except during a running session, where it would steal focus and risk
  a mis-tap. It is plain links to the hashes above, with no router library.
- **Legacy URLs:** `#/session?…` keeps parsing and redirects (`replaceState`)
  to `#/learn/session?…`, so existing recents and bookmarks don't break. Bare
  `#/` now shows the entry page. Optional: once a section has been chosen,
  remember it in prefs and skip the entry page.
- **Code layout:**

  ```
  src/lib/transcribe/   ported core.js (pure pipeline, TS)
  src/lib/ideate/       Ideate UI (Svelte components)
  src/lib/audio/        shared: context, pitch listener, mic picker, metronome
  ```

## Phases

Each phase is one PR and ships on its own.

### Phase 0: entry page and nav shell (small)

- Add the entry page plus the `Learn | Ideate` header.
- Make the hash-routing changes and the legacy redirect, with tests in
  `routing/hash.test.ts`.
- Ideate shows a placeholder card linking to Phase 1.
- Done when existing tests pass, legacy URLs redirect, and the nav works on
  phone width.

### Phase 1: Ideate ships as-is (fast path, small)

- Vendor Whistler's `index.html`, `app.js` and `core.js` into
  `public/ideate/`. Vite copies `public/` into `dist/` verbatim, with no
  bundling, so the CDN imports keep working.
- `#/ideate` renders it in a full-height `<iframe src="ideate/index.html">`
  with `allow="microphone"` (same origin, so mic permission is shared).
- Leave out `serve.py`, `spike/` and `test/`. The fixtures stay in the
  Whistler repo for now.
- **Result:** one app and one deploy, with Whistler fully working.
- **Cost:** two codebases inside one repo, and two copies of pitchy (one from
  npm, one from the CDN). This is acceptable as a stepping stone.

### Phase 2: port the pipeline to TypeScript (medium)

**Status: done.** `src/lib/transcribe/` (detect, basicPitch, fretting, quantize, score) with
vitest coverage; harness at `/ideate-test.html` (dev only) with `test/fetch_fixtures.py`.
`IdeateScreen` is now lazy-loaded. The iframe keeps its own `core.js` until Phase 3.

- `core.js` becomes `src/lib/transcribe/*.ts`, split by concern:
  - `detect.ts`: `detectNotes` and `estimateLag`
  - `basicPitch.ts`
  - `fretting.ts`: `mapNotes`, `midiToFret`, `chordFrets`. Reconcile these
    with `music/notes.ts` and `tuning.ts`; there should be one `OPEN`-strings
    and `hzToMidi` source.
  - `quantize.ts`
  - `score.ts`: alphaTex and `.gp` export
- Use npm dependencies instead of CDN imports for pitchy (already installed)
  and fflate. Keep **lazy dynamic `import()`** for Basic Pitch, onnxruntime
  and demucs so their weight never reaches the Learn bundle. The models still
  download at runtime from their CDNs or caches, which is frontend-only and
  needs no server.
- **alphaTab:** keep loading it lazily via the CDN `<script>` (only on Ideate).
  The npm package needs its Vite plugin to copy fonts, the soundfont and
  workers. Only switch if the CDN script becomes a problem.
- **Tests:** unit-test the pure functions in vitest (quantize, fretting, tex).
  Port the browser fixture harness as a dev-only page
  (`/ideate-test.html`, not linked in the UI), bring the fixtures and
  `ATTRIBUTION.md` along, and use Git LFS or keep fixtures out if repo size
  matters.
- The Phase-1 iframe now imports from the shared TS modules, or Phase 3
  follows immediately.

### Phase 3: Ideate UI in Svelte (large)

**Status: done, except archiving.** Components in `src/lib/ideate/` (Recorder, JobsDrawer,
CleanupPanel, WaveformSelect, Calibration, SeparationToggle, shared state); metronome and
calibration in `src/lib/audio/`. `public/ideate/` and the iframe are gone. The
`whistler.calib` key and the `whistler` IndexedDB are read as-is (no migration into prefs),
so existing data carries over. Archiving the Whistler repo is left to the user. Not verified:
mic recording, live tuner and calibration (need a real mic), source separation (172 MB
model), Safari/iOS.

- Rebuild `app.js` as components:
  - Recorder (metronome, count-in, live tuner)
  - JobsDrawer (IndexedDB queue)
  - CleanupPanel (alphaTab render, playback, re-transcribe)
  - WaveformSelect
  - Calibration
  - SeparationToggle
- Use the app's theme tokens and its mic picker (`MicSettings.svelte`).
- Delete `public/ideate/` and the iframe.
- Persistence stays IndexedDB plus `localStorage`. Migrate
  `whistler.calib` into prefs, keeping the old key's value.
- Done when every README-listed Whistler feature works and the Whistler repo
  is archived. Archiving needs user sign-off.

### Phase 4: crossover into Learn (incremental, per exercise)

The Whistler pipeline lifts constraints recorded in
[the improvisation roadmap](../specs/2026-10-31-improvisation-roadmap-design.md):

- **Hearing chords (polyphonic).** Basic Pitch removes the "mic is
  monophonic" constraint:
  - CAGED and triad drills can judge a *strummed* chord: the detected pitch
    classes must equal the chord's, and optionally the lowest note must match
    for inversions.
  - Harmonic ear training becomes testable on real guitar.
  - Trade-off: the model downloads on first use and analysis is per chunk, not
    instant. Use it as "play, then check", with pitchy kept for live
    single-note judging.
  - [x] **Done for CAGED find-tones:** a "Strum it" / "Strum it, root in
    bass" mic judging option. `src/lib/audio/strum.ts` records a 2 s take
    (onset-triggered after a quiet gap, with 150 ms pre-roll, or the Record
    now button), Basic Pitch runs via a dynamic import of `detectNotes`
    (`engine: 'ai'`), notes under 30% of the loudest are dropped, and the
    pitch-class set must equal the chord's exactly. Decisions: the "expected
    bass" is the chord root (every CAGED voicing is root-position); a wrong
    strum keeps the prompt open (marked wrong) so the player strums again;
    the Basic Pitch model instance is cached across takes. Triad drills and
    harmonic ear training are not done yet.
- **Rhythm.** Whistler's metronome, count-in, beat-grid quantization and
  **latency calibration** (`estimateLag`) close the rhythm gap. Possible
  exercises: timed chord-tone targeting, "play on beat 1/the and", and
  scoring onset error in ms. Move the metronome and calibration into
  `src/lib/audio/` as shared code.
  - [x] Timed chord-tone targeting: shipped 2026-10-31 (shared metronome,
    and the `whistler.calib` offset shifts the mic judging cut-over). See
    `../specs/2026-10-31-chord-tone-targeting-design.md`.
  - [ ] "Play on beat 1/the and" and scoring onset error in ms.
- **Tuner.** The live cents readout becomes a shared widget, usable as an
  intonation check in any mic exercise.
  - [x] **Done:** `src/lib/audio/tuner.ts` (`tunerReading`) and
    `src/lib/components/Tuner.svelte` (note, cents, needle, green within
    ±15¢). Ideate's Recorder uses it. In Learn, `startPitchListener` reports
    a reading every frame (`onTuner`), so no second mic is opened. The
    widget appears in Play the Shape and CAGED note-by-note mic sessions
    behind a "Tuner" header toggle. It is off by default and remembered in
    prefs (`showTuner`), not in the session hash, since it doesn't change
    the drill. It is not offered in CAGED strum mode, which doesn't run
    pitchy.
- **Call and Response** (roadmap item 5). Record the response, transcribe it
  with `detectNotes` and quantization, and compare it note by note against
  the prompt phrase, rhythm included.
- **Ideate to Learn bridge** (later). Take a transcribed idea and drill it,
  for example "play this lick in another key or position" using the fretting
  logic. This is the roadmap's "vocabulary transfer" gap.
- **Fixture harness.** GuitarSet guitar takes become regression tests for
  every mic-judged exercise. Today those exercises have no real-audio tests.
  - [x] **Done:** `src/lib/transcribe/harness/learn.ts` replays GuitarSet
    takes through Learn's live judging path. That path is
    `createFrameJudge` in `audio/pitch.ts`, now shared with
    `startPitchListener`, run as `listenOffline` with 2048-sample frames at
    60 fps. The check is that the annotated notes are heard: a same-pitch
    onset between 50 ms before the note and 100 ms after it ends. It
    reports recall and precision. Decisions: notes under 120 ms are left
    out, because the onset detector needs about 83 ms of stable pitch by
    design. Takes are peak-normalized to 0.5, since the Jazz1 mic take
    peaks at 0.07 and would sit under the default loudness floor.
    Measured: Jazz1 77% / 94%, BN1 69% / 98%. It runs as the `learn` engine
    on `ideate-test.html` and in `learn.test.ts`, which skips when the
    fixtures are absent (CI). Strum mode (Basic Pitch) needs chord
    fixtures and is not covered yet.

## Risks and mitigations

- **Bundle weight leaking into Learn.** Ideate code and heavy libraries must be
  dynamic imports. Add a build check that compares the Learn chunk size before
  and after.
- **Mic contention.** Two sections might each open `getUserMedia`. Share one
  `audio/context.ts` and stop streams on route change.
- **iOS/Safari.** Whistler is tested in Chrome. Check `AudioContext` resume,
  `MediaRecorder` formats and IndexedDB quotas on Safari before Phase 3 is
  called done.
- **CDN availability.** The models load from jsDelivr at runtime, so an
  outage takes down only Basic Pitch and Demucs. pitchy and fflate get
  bundled in Phase 2, so live detection keeps working.

## Open decisions (user)

1. Should Phase 1 (the iframe fast path) happen, or go straight to Phases 2–3?
   **Recommendation:** do Phase 1. It is cheap and gets one deploy now.
2. Should the `whistler` repo be archived after Phase 3, or kept as the
   upstream and synced? **Recommendation:** archive, since a single source of
   truth is simpler.
3. Should the test fixtures (7.7 MB) come into this repo as plain files, as
   Git LFS, or be fetched by the existing `fetch_fixtures.py`-style script?
   **Recommendation:** a fetch script with a manifest, so the repo stays
   small.
4. Should the entry page always show, or remember the last section?
   **Recommendation:** remember it, and keep the nav switch.
