# Lick Drill (Ideate to Learn bridge) — Design

Date: 2026-10-31
Status: shipped. The "Ideate to Learn bridge" bullet of the Whistler
integration plan's Phase 4, and part of the improvisation roadmap's
"vocabulary transfer" gap.

## Goal

Take a lick you played or whistled into Ideate and learn to move it: play it
from another note and/or from another string.

## Making a lick (Ideate)

- The cleanup panel of a finished job has a **Drill in Learn** block: a
  "From note" / "to" range (1-based, over the notes as the tab shows them,
  that is `mapNotes` with the job's anchor and octave shift), a name
  (defaults to the job name), and a live preview of the note names.
- A lick holds at most 16 notes (`MAX_LICK_NOTES`). Pitches only: the drill
  is about key and position, not rhythm, so durations are dropped.
- On save the line is moved by whole octaves into the guitar's range
  (E2–E6, `fitGuitar`), since whistled takes sit high.
- **Drill this in Learn** saves the lick and goes to `#/learn` with the
  Lick Drill card and that lick selected (via prefs `exercise` and `lickId`).
- Decision: the note range, not the waveform selection, trims the lick. The
  waveform selection re-transcribes audio; a note range is exact and needs
  no second transcription.
- Decision: licks live in localStorage (`guitar-exercises.licks.v1`, newest
  first), not in the `whistler` IndexedDB. They are a few bytes each, Learn
  must read them synchronously at start-up, and the job store stays
  untouched, so existing job data can't break.

## The drill (Learn)

- New card **Lick Drill** in a "Licks" group. The settings list the saved
  licks (name and note names) with a delete button each. With none saved,
  the card explains how to make one in Ideate and Start is disabled.
- **Start on:** same key, random key (any of the other 11, drawn per
  prompt), or a fixed note. The lick is shifted by the nearest interval
  (−6..+5 semitones) that puts its first note on that pitch class.
- **Start string:** any, random (per prompt), or a fixed string 6–1.
- **Placement** (`placeLick`): the first note goes on the start string (or
  the lowest-fret spot when the string is "any"). Every other note goes on
  the string that keeps it nearest the first note's fret, using
  `fretting.ts`'s `chordFrets` voicing rule, so the answer stays in one
  position. If that doesn't fit within the fret range, it tries an octave
  down, up, then two. A prompt that can't be placed is redrawn; after 50
  tries it falls back to the original lick on any string.
- **Prompt:** "Penta: play it starting on D on the 5th string". The
  original lick is played (pluck synth, even eighths at 90 bpm) and shown on
  the neck in its original position. Replay and "Show me" work as in Call
  and Response.

## Judging

- Reuses Call and Response's session body (`CallResponseBody.svelte`):
  the click and mic input, echo guard, pause, give-up, and per-note slots.
  The rule is the same too: notes are judged **in order, by pitch class, at
  any octave**, and the first wrong note ends the lick and reveals it.
- Decision on leniency: any octave counts, because pitchy's octave errors on
  guitar would otherwise fail correct takes, and the start string already
  pins the register for clicks.
- Clicks know the string, so the **first click must be on the asked start
  string**. The mic can't tell strings, so the string is a guide only there.
- On a miss, the neck shows the answer positions (the transposed lick
  fretted from the start string).
- `LickDrillExercise` is its own small class rather than a subclass of
  `CallResponseExercise`: its prompt and report are different, and the
  in-order step is a few lines.

## Report

- Per transposition: "+5 (start on D)", "Same key", and so on, sorted by
  shift.
- Per note index ("Note 1", "Note 2", …): each note up to and including the
  first wrong one, as with Call and Response's per-degree breakdown.

## Plumbing

- Exercise id `lick-drill`.
- URL: `ex=lick-drill&lick=<code>&lname=<name>&to=same|random|<note>&sstr=any|random|1..6&input=click|mic&sens=…`
  plus the usual duration/frets/fretnums/sound. The URL carries the lick, so
  a link works on a device that never saved it.
- Lick code: one URL-safe character per note, MIDI 28–91 mapped onto
  `A–Z a–z 0–9 - _`. At most 16 characters; anything else falls back to
  Learn. The name is cut to 40 characters.
- Prefs: `lickId`, `lickTarget`, `lickStartString`. Mic settings are shared.
- Code: `src/lib/exercise/lick/` (types, `lick.ts` helpers,
  `LickDrillExercise.ts`), `src/lib/storage/licks.ts`,
  `src/lib/components/start/LickDrillSettings.svelte`.
- Bundle: the Learn side imports only `fretting.ts` (no dependencies) from
  `transcribe/`. Ideate imports the small lick and prefs helpers from Learn,
  not the other way round.

## Deferred

- Rhythm: keep the take's durations and judge timing like Call and
  Response's rhythm option.
- Exact-pitch judging as an option, and judging the string of every note for
  clicks (a "same fingering" mode).
- Renaming licks, and making licks from the waveform selection.
- Playing the lick over a backing track or progression.
