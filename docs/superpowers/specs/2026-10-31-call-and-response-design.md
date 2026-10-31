# Call and Response — Design

Date: 2026-10-31
Status: shipped. Item 5 of `2026-10-31-improvisation-roadmap-design.md`, plus
the "Call and Response" bullet of the Whistler integration plan's Phase 4.

## Goal

Ear to fingers. The app plays a short phrase in a key, and the player plays it
back.

## Phrase

- **Key:** a fixed note or random (re-drawn per phrase). Major keys only. The
  root sits in the E3–D#4 register (MIDI 52–63).
- **Allowed degrees:** any of the major-scale degrees 1–7 (at least two;
  default 1, 3, 5). The pitch pool is those degrees from the root up to the
  octave, plus the upper root when 1 is allowed.
- **Length:** 2, 3 or 4 notes (multi-select, drawn per phrase; default 3).
- **Motion:** `stepwise` moves to a neighbouring note of the pool (so with
  1-3-5, a step is 1→3 or 3→5), and `leaps` moves to any other pool note.
  A note never repeats the previous one.
- **Show the starting note:** the header names the first note and its degree.
- **Rhythm** (off by default): when on, each note is an eighth or a quarter
  at 90 bpm (`PHRASE_BPM`). When off, the notes are even quarters.
- The phrase is played with the pluck synth through `playSequence`, which now
  takes a gap per note. There is a Replay button. "Drone the root" (the
  modes' `drone` pref) holds the key root under it with `audio/drone.ts`.

## Judging

- **In order, by pitch class, at any octave.** The player can answer in any
  register, and a guitar phrase played an octave up is the same phrase. The
  first wrong note ends the phrase as a miss and reveals it.
- **Mic: a live pitch listener (`startPitchListener`), not record-then-
  `detectNotes`.** This is the choice the plan left open. The reasons:
  - Feedback per note, as the notes are played, which matches every other
    mic exercise.
  - The onset detector is already tuned for guitar here and in Play the
    Shape / CAGED.
  - No `MediaRecorder` or decode round-trip, and no need to guess when the
    take ends: the phrase length says when to stop.
  - `detectNotes` works on a finished buffer; it is the better tool for
    polyphony or long takes, which this drill doesn't need.
- **Rhythm (optional, mic only):** the onset times from the listener are
  compared with `quantize.toSixteenths` at `PHRASE_BPM`. Each inter-onset
  interval must round to the phrase's eighth (2) or quarter (4). Latency is a
  constant offset, so it cancels out of the intervals; no calibration is
  needed. Pitches right but rhythm off counts as a miss, and the hint says so.
- Mic input is ignored while the phrase plays, plus 400 ms after, so the
  speaker isn't heard as the answer.
- **Click fallback:** click positions on the fretboard in order. The same
  any-octave pitch-class rule applies. Rhythm isn't judged for clicks, so the
  start screen only offers it with the mic. Clicks count even while the call
  is still playing, since there's no echo to guard against. If the mic is
  unavailable, clicks work instead.
- **Give up:** "Show me" reveals the phrase and counts a miss.
- The prompt's time runs from the end of playback to the last note.

## Report

- Per phrase length ("3 notes").
- Per degree: each phrase note up to and including the first wrong one. Notes
  after a mistake weren't attempted, so they don't count against their
  degree. Time is that phrase's time.

## Plumbing

- Exercise id `call-response`, a new "Ear" card group.
- URL: `ex=call-response&lens=2,3&degs=1,3,5&motion=step|leap&start=0|1&rhythm=0|1&keyroot=…&drone=0|1&input=click|mic&sens=…`
  plus the usual duration/frets/fretnums/sound.
- Prefs: `phraseLengths`, `phraseDegrees`, `phraseMotion`, `showStartNote`,
  `judgeRhythm`. Key root, drone and the mic settings are shared.

## Deferred

- Minor and modal keys, chromatic degrees.
- Longer phrases, and a call-and-response over a progression (combining with
  Chord-Tone Targeting).
- Scoring onset error in ms rather than by sixteenth.
