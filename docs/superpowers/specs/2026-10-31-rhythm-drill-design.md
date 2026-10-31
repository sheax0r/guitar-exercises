# Rhythm Drill (Time Feel) — Design

Date: 2026-10-31
Status: shipped. This is the "Play on beat 1/the and, scoring onset error in
ms" bullet of the Whistler integration plan's Phase 4 (Rhythm).

## Goal

Time feel. The metronome plays, and the player plays any note where the
prompt says: on beat 1, on every beat, on the "and"s, or in a short pattern.
Each target is scored by how early or late the note was, in ms.

## Drill

- **4/4 only**, quarter-note BPM 40–200 (default 80, shared with Chord-Tone
  Targeting's `bpm` pref). There is one bar of count-in, then 4, 8 or 16 bars
  (default 8). The session ends after the last bar. There is no timer and no
  fretboard.
- **Targets (`tgt`):**
  - `one`: beat 1 of each bar.
  - `beats`: every beat (default).
  - `ands`: the offbeat eighths.
  - `pattern`: one pattern per bar, drawn from Charleston (1, 2&), Backbeat
    (2, 4), Tresillo (1, 2&, 4) and Push (1, 2, 3, 4&).
- The screen shows the bar as eight eighth-note slots. The targets are
  filled, and the current beat is lit. After each bar, the screen shows that
  bar's errors ("2 -10 ms", "3 miss", "1 extra") and the running mean.
- The metronome clicks every beat, through the last bar (the shared
  `audio/metronome.ts`).

## Onsets: an amplitude path, not the pitch listener

`audio/onsets.ts` has `AmpOnsetDetector` (pure, unit tested) and
`startOnsetListener`. Why not `startPitchListener` / `OnsetDetector`:

- The pitch path accepts a note only after the pitch is stable over several
  2048-sample frames. Its onset time is late by a variable 30–80 ms, which is
  as large as the errors this drill measures.
- Rhythm doesn't care about pitch. Muted or percussive strums should count.

How it works:

- It reads the analyser's newest 2048 samples every animation frame. Each
  256-sample block (about 5 ms) is judged once, aligned to absolute sample
  positions in AudioContext time. Overlapping frames don't double-count, and
  dropped frames just skip.
- **Onset:** the block's peak is over the loudness floor, more than 1.4× the
  maximum of the previous four blocks (about 21 ms, longer than one low-E
  period, so a ringing note's ripple doesn't re-trigger), and 80 ms or more
  after the last onset. The onset time is the block start, so it is within
  about 5 ms.
- The floor comes from the shared mic sensitivity (`rmsFloorForSensitivity`
  × 2, because this is a peak and not an RMS).
- **Keeping the click out:**
  - The mic is opened with `echoCancellation: true`, and with
    `autoGainControl` and `noiseSuppression` off because they flatten
    attacks. `openMic` gained an optional constraints argument for this.
  - A 600 Hz low-pass sits before the analyser. The clicks are 1 kHz and
    1.6 kHz sines, and a pluck has plenty of energy below that.
  - Headphones are still recommended (start-screen hint).

## Latency

- **Mic:** each onset is shifted by the shared `whistler.calib` offset
  (`loadCalibMs()`; negative when input arrives late), so `t + calib/1000`
  is when the note was played.
  - When no calibration is saved, the start screen and the report say so,
    with a link to Ideate (More options → Calibration).
  - The report always shows the offset that was applied.
- **Taps (`input=click`):** a key (any but space, which pauses) or the
  on-screen pad. `eventToCtxTime` uses `AudioContext.getOutputTimestamp()` to
  map the event time to the context time audible at that moment, so output
  latency is removed. Keyboard and touch input latency (often 10–30 ms) is
  not corrected. This is documented on the start screen and in the report.
  This is the no-mic fallback. If the mic fails in a mic session, taps work
  instead.
- **Caveat:** Ideate measures `whistler.calib` from a MediaRecorder take
  (`calibrate` → `estimateLag`), not through the live analyser this drill
  uses. Whether the two paths agree on real hardware is unverified. A
  constant residual shows up as the report's bias. A later in-drill
  calibration through the same onset path would remove that doubt.

## Scoring (`exercise/rhythm/rhythm.ts`, pure)

- `gridTargets` turns bar slots into AudioContext times and kinds: `one`
  (beat 1), `beat` (2–4) and `and`.
- `scoreRhythm(targets, onsets, toleranceMs)`:
  - Each onset goes to its nearest target. Within the tolerance it is a
    candidate, and the closest candidate is the hit, with its signed error in
    ms (positive = late).
  - Every other onset is an **extra hit**.
  - **Accuracy = hits / (targets + extras)**, so missed targets and extra
    hits both count against it. The header tally is ✓ hits and ✗ (misses +
    extras).
- **Tolerance:** ±30, ±50 (default) or ±80 ms.
- Onsets are grouped by bar: a bar starts half an eighth before its
  downbeat, so an early beat 1 belongs to its own bar. Onsets during the
  count-in or after the last bar are ignored.
- A bar is scored after its end plus the tolerance, plus |calibration|, plus
  100 ms, so late notes still in the pipeline arrive first.

## Pause

Pausing stops the metronome and drops the unfinished bar (its targets and
onsets). Resume gives a new one-bar count-in, and that bar is played again.
Scored bars are kept.

## Report (`RhythmReport.svelte`, lazy-loaded)

- Accuracy, hits/targets, extra hits, mean absolute error, and bias (mean
  signed error: "12 ms late").
- Per target type (Beat 1 / Beats 2–4 / The ands): hits, hit rate and mean
  absolute error.
- **Timeline:** each target's error in play order, with a tolerance band.
  Late points are above the line, early points below, and misses are ✕.
- The offset that was applied, or the tap-latency note.

The generic `ReportScreen` is left alone. `App` routes `rhythm` to this
screen.

## Plumbing

- Exercise id `rhythm`, card "Time Feel" in a new "Rhythm" card group. The
  Duration, Frets and More options rows are hidden for it.
- URL: `ex=rhythm&tgt=one|beats|ands|pattern&bpm=…&bars=4|8|16&tol=30|50|80&input=mic|click&sens=…`.
  Off-menu bars or tolerance fall back to the defaults, and BPM is clamped.
- Prefs: `rhythmTarget`, `rhythmBars`, `rhythmTolerance` and `rhythmInput`.
  The input defaults to the mic, separately from the shared `inputMode`,
  which defaults to clicks. `bpm` and the mic settings are shared.
- Summary: "Rhythm · The ands · 90 bpm · 8 bars · ±50 ms · Mic".

## Verified / not

- Unit tests:
  - Grid and scoring.
  - Onset detector on synthetic plucks: timing within 8 ms, a ringing note
    under a new pluck, a sustained low E heard once, the floor, and dropped
    frames.
  - Hash, summary and start screen.
- Component tests with a mocked metronome and onset listener: per-beat ms
  feedback after the offset, misses, an extra, count-in onsets ignored,
  pause/replay, and tap timing.
- Headless browser: a tap session runs on the real audio clock through to
  the report.
- **Not verified:**
  - Real mic onsets on a guitar. The GuitarSet fixtures weren't fetched
    here.
  - Whether echo cancellation and the low-pass keep a speaker click out.
  - Agreement between `whistler.calib` and this path.

## Deferred

- Other meters, sixteenths and triplets.
- An in-drill latency calibration through the same onset path.
- Muting the click for some bars ("gap click") to test internal time.
- Choosing patterns.
