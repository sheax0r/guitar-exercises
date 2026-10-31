# CAGED Shapes — Design

Date: 2026-10-31
Status: shipped. Item 1 of `2026-10-31-improvisation-roadmap-design.md`. The user
pre-authorized spec → implement → ship; the calls below were made without
review and are recorded here.

## Goal

Train chord tones inside a position (roadmap layer 3), drilled as single notes
because the mic is monophonic. One new exercise, `caged`, in a new **Chords**
card group on the Learn start screen.

## Shape model (`src/lib/music/caged.ts`)

A shape is a fret window anchored on a root string. Its notes are every
position in the window whose pitch class is a chord tone. All keys and chord
types fall out of the pitch-class filter.

| Shape | Root string | Window (frets relative to root fret) |
|---|---|---|
| C | 5 | root−3 … root |
| A | 5 | root … root+2 |
| G | 6 | root−3 … root |
| E | 6 | root … root+2 |
| D | 4 | root … root+3 |

- **Change from the roadmap table:** A was `root … root+3`. The roadmap's own
  sanity case ("A shape of A: window 0–2") and every open A voicing (A, Am,
  Amaj7, A7, Am7) fit in `root … root+2`, so the table was corrected.
- `cagedInstances(shape, root, maxFret)` returns every placement that fits:
  root fret f, f+12, f+24 on the root string. A window that would start below
  fret 0 is skipped, so it only appears an octave up (the roadmap's "+12" rule).
  Windows past `maxFret` are dropped.
- Tests check the five open-chord windows and that each open voicing (triads and
  7ths, 21 voicings) lies inside its window. They also check that the C chord
  tiles the neck C(0) → A(3) → G(5) → E(8) → D(10) → C(12).
- **Chord types:** `maj`, `min`, `maj7`, `7`, `m7`. Settings choose qualities
  (major, minor) and "include the 7th". With the 7th on, major draws maj7 or
  dominant 7 and minor draws m7. With it off, plain triads.

## Variants (`cagedVariant`)

- **find-tones:** "A major — E shape". The anchoring root is marked. Click every
  chord tone in the window, in any order. Scored like a Play the Shape box: the
  prompt completes when all are hit, and any wrong or repeated click marks it
  missed.
- **name-shape:** the window's chord tones are shown, with roots marked. Pick
  the shape letter and the chord root; the answer is judged once both are
  picked. The quality is shown in the header, since only shape and root are
  asked. With a fixed root, the root is pre-filled and only the shape is asked.
  Only enabled shapes are offered.
- **next-shape:** "In the E shape of A major — play the D shape roots up the
  neck". The current shape's chord tones are shown. The target is the next shape
  in the C→A→G→E→D cycle (regardless of which shapes are enabled), placed at
  its lowest window that starts above the current one. The player clicks every
  root note inside that window, scored like find-tones. Prompts whose next shape
  doesn't fit in `maxFret` are redrawn.

Prompts are redrawn (bounded, 500 tries, then throw) when nothing fits. An exact
repeat of the previous prompt is avoided unless the config allows only one
prompt.

## Mic

find-tones only. A heard pitch claims the lowest un-hit window position of that
pitch class, in any order, so octave doesn't matter. This is the same rule and
the same plumbing (`audio/pitch.ts`, `MicSettings`, the pause-overlay settings
and auto-advance) as the Play the Shape box. The hash coerces mic to click for
the other variants.

## Settings, persistence, URL

- Settings: drill (variant), shapes, chord qualities, include 7th, chord root
  (fixed or random), input (find-tones), plus the usual duration, frets, fret
  numbers and sound options.
- Prefs: `cagedVariant`, `enabledShapes`, `chordQualities`, `include7th`.
  Root (`fixedRootNote`), input mode and mic settings are shared with the modes
  cards.
- Hash: `ex=caged&cvar=…&shapes=C,A,…&quals=major,minor&sev=0|1&root=…&input=…&sens=…`
  plus the shared duration/frets/fretnums/sound params. Shapes and qualities
  must be non-empty and valid, otherwise the hash falls back to the start
  screen.
- Summary line, e.g. `CAGED · Find tones · CAE · major/minor 7ths · in A · Mic · 5m · 12 frets`.

## Report

The modes per-mode table now renders generic per-group stats, so CAGED shows
"Per shape" (accuracy and average time per asked shape) and "Weakest shapes".
For next-shape the stat goes to the target shape. `aggregateGrouped` in
`exercise/modes/report.ts` is shared by both.

## Deferred

- The roadmap's "highlight degrees" narrowing for find-tones (e.g. only the
  3rds).
- Drone and the window/scale overlay used by the modes exercises.
- Mic for next-shape: it would be judged by pitch class too, which can't tell
  the target window's roots from the current shape's.
- Session screens still overflow at phone width because of the fretboard's
  800px minimum width. This affects every exercise and predates CAGED.
