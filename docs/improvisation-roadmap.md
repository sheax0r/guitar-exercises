# Improvisation Roadmap — Design

Date: 2026-10-31
Status: roadmap, not yet approved for implementation. Each numbered item below
is meant to become its own spec → plan → PR when picked up. Order is the
recommended build order.

## Goal

Move the app from "know the notes" towards "comfortable improvising". The
pedagogy research (CAGED, chord-tone soloing, guide tones, call-and-response)
lays out these skill layers:

| Layer | Skill | Covered today |
|---|---|---|
| 1 | Note names anywhere on the neck | Yes: Root Notes |
| 2 | Scale degrees relative to a key/chord | Partly: Intervals (diatonic 3rd/5th only) |
| 3 | Chord tones / arpeggios inside a position (CAGED) | **No** |
| 4 | Scales attached to those positions | Partly: modes only, no pentatonic/blues/minor variants |
| 5 | Targeting chord tones over changes | **No** |
| 6 | Ear to fingers (hear it, play it) | Partly: drone, Identify-by-ear |

Layers 3 and 5 are the real gaps. They come first.

## Constraints that shape every item

- **Mic is monophonic.** `audio/pitch.ts` detects a single note. Nothing may
  require judging a strummed chord. Chord work is drilled as single notes and
  arpeggios, which is also how CAGED is usually practised.
- **Reuse, don't fork.** The building blocks already exist:
  - `noteAt`, `pitchOf` and `closestPositionOf` in `music/notes.ts`
  - the `boxWindow` / `boxPositions` window logic in `exercise/modes/shape.ts`
  - drone, pluck and sequence in `audio/`
  - the `Exercise<...>` interface and the README's "Adding another exercise
    type" checklist
- Every new option is persisted in prefs and the URL hash like existing options.
  Defaults reproduce current behaviour.

## 1. CAGED Shapes (new exercise, new "Chords" card group)

### Shape model

A CAGED shape is a **fret window anchored to a root on a given string**. Its
notes are every position in the window whose pitch class is a chord tone. No
per-shape fingering tables are needed; all 12 keys and chord qualities fall out
of the pitch-class filter.

| Shape | Root string | Window (frets relative to root fret) |
|---|---|---|
| C | 5 | root−3 … root |
| A | 5 | root … root+3 |
| G | 6 | root−3 … root |
| E | 6 | root … root+2 |
| D | 4 | root … root+3 |

If the window starts below fret 0, add 12 to the root fret. Reject it if it
then exceeds `maxFret`.

**Sanity tests (the open chords):**

- C shape of C: root 5/3, window 0–3
- A shape of A: root 5/0, window 0–2
- G shape of G: root 6/3, window 0–3
- E shape of E: root 6/0, window 0–2
- D shape of D: root 4/0, window 0–3

Each must contain that chord's open-position tones. Tune the windows if a test
shows a missing or extra tone; the table above is the starting point, not
gospel.

**Chord qualities:** major and minor triads first. Adding the 7th (maj7,
dominant 7, m7) is just more pitch classes in the filter.

### Variants (`cagedVariant`)

- **find-tones:** the prompt is something like "A major, G shape"; a
  "highlight degrees" option can narrow it, e.g. to just the 3rds. The player
  clicks every chord tone in the window, or only the requested degrees. Scored
  like a Play the Shape box: done when all expected positions are clicked,
  wrong clicks count.
- **name-shape:** chord tones in a window are shown. The player picks the shape
  letter (C/A/G/E/D) and the chord root. This is the visual-identification
  mirror of find-tones, like Identify the Mode.
- **next-shape:** "You're in the E shape of A. Play the D shape." The player
  clicks the root(s) of the next shape up the neck. This trains the C→A→G→E→D
  cycle and connecting positions.

### Mic

find-tones accepts mic input. Played pitches are judged by pitch class within
the window, in any order. Reuse the mic plumbing from Play the Shape.

### Settings

- shapes enabled (multi-select C/A/G/E/D)
- chord qualities
- root: fixed or random
- include 7th
- variant
- the usual duration, frets and sound options

### Report

Per-shape accuracy and time, the same layout as the per-mode stats.

## 2. Chord-Tone Targeting (new exercise)

The most direct improvisation drill.

- The app loops a progression with the pluck synth and `sequence.ts`, or
  sustains the chord root as a drone.
- **Progressions:** I–IV–V, ii–V–I, 12-bar blues, I–vi–IV–V, in any key (fixed
  or random).
- On each chord change the player must play or click the requested **target
  tone**:
  - any chord tone
  - 3rd
  - 7th
  - guide tones (alternate 3rd and 7th)
- **Nearest-position rule:** the answer must be the occurrence of the target
  nearest to the player's *previous* answer. Reuse `closestPositionOf` with the
  previous answer as the origin. This is voice leading: small moves between
  chords. The first prompt starts from a random position, as Root Notes does.
- **Tempo:** untimed (advance on answer) first. A bars-per-chord timed mode
  where a missed change counts as a miss is a later option.
- **Mic:** judge by pitch class plus nearness (within N frets of the expected
  position).
- **Report:** accuracy per chord degree (I, IV, V, ii…) and per target type.

## 3. Interval and degree upgrades (extend existing exercises)

- **Intervals:** add 2nd, 4th, 6th and 7th to `Interval`. Add a reference mode
  `from-root`: the interval is measured from the key root and includes
  chromatic intervals (b3, b7, #4, b9…). The current behaviour is
  `diatonic-from-note`.
- **Name the Degree** (a new variant of Intervals, or a sibling card):
  - forward: a key and a highlighted note are shown, and the player names the
    degree (1, b2, 2 … 7)
  - reverse: "find the b7 of D", using the nearest-position rule from a start
    position

## 4. Scale types beyond the modes

- Generalize `Mode` into a `ScaleType` that adds:
  - major pentatonic
  - minor pentatonic
  - blues
  - harmonic minor
  - melodic minor
- Play the Shape and Identify the Mode use them unchanged. They already work
  from pitch-class sets.
- Add a `caged` shape variant to Play the Shape. It uses the CAGED windows from
  item 1 instead of the fixed-span box. The five pentatonic boxes are the five
  CAGED positions, so the two items share one model.
- Mic input for box/CAGED variants is judged by pitch class, in any order.
  Today mic works only for octave runs.

## 5. Call and Response (new exercise)

- The app plays a short phrase in a key over the drone: 2–4 notes, drawn from
  allowed scale degrees, using the existing pluck and sequence code.
- The player plays it back into the mic. Each note is judged by pitch, in
  order.
- **Difficulty:**
  - phrase length
  - allowed degrees (start with 1, 3, 5)
  - stepwise or leaps
  - a fixed starting note shown, or not
- Click fallback: the player clicks the positions in order (the pitch-class
  answer is accepted at any octave).

## 6. Root Notes: "find all" variant

Find every occurrence of the target within a fret window or the whole neck,
against the clock. This trains octave shapes directly; today the exercise only
asks for the nearest one.

## Remaining gaps (not covered by items 1–6)

These are skills improvisers need that this roadmap still leaves untrained.
They are recorded so they are not forgotten; none is scoped yet.

- **Rhythm, timing and phrasing.** There is no metronome, beat grid or rhythm
  judging. Every drill is untimed note-finding, but improvising is largely
  rhythmic: phrase length, rests, playing on and off the beat. Item 2's timed
  mode is the first step only.
- **Triads on string sets.** Closed and inverted triads on adjacent three-string
  groups (1-2-3, 2-3-4, 3-4-5, 4-5-6) and moving them along one string group.
  CAGED covers whole-position shapes, not small inversions, which are the
  core rhythm and comping vocabulary.
- **Other position systems.** Three-notes-per-string scale fingerings and
  playing along one string (horizontal scale movement). The app is
  window/position-centric.
- **Harmonic ear training.** Recognizing chord quality (major/minor/dom7…) and
  progressions (I–IV–V vs ii–V–I) by ear. Today the ear work covers notes,
  modes and, with item 5, phrases, but not chords.
- **Audiation / singing.** Singing a degree or phrase before playing it, or
  sing-then-check against the mic. The mic could judge voice as well as guitar.
- **Approach notes and enclosures.** Chromatic approaches into a target chord
  tone (above, below, both). This is a natural later variant of item 2.
- **Advanced harmony for jazz soloing.** Altered scale, diminished,
  whole-tone, and modes of melodic minor over dominant chords. Item 4's
  `ScaleType` makes these cheap to add once wanted.
- **Vocabulary transfer.** Learning licks and moving them to other keys and
  positions, and connecting the drills to real songs or backing tracks.
  Possibly out of scope for a drill app.
- **Tunings.** Only standard tuning (`music/tuning.ts`). Drop D, DADGAD and
  others are not supported.
- **Long-term progress.** No history beyond recent sessions: no streaks,
  trends or per-skill mastery view. This overlaps with adaptive drilling
  below.

## Deferred (not planned now)

- **Adaptive drilling and cross-session weakness tracking.** Weight prompts
  toward what was missed before. Revisit after items 1–2 ship. Today's
  per-session reports are enough to start with.
- **Polyphonic chord detection.** Not needed: everything above works with
  single-note input.
