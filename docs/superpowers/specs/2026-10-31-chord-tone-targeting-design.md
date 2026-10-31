# Chord-Tone Targeting — Design

Date: 2026-10-31
Status: shipped. Item 2 of `2026-10-31-improvisation-roadmap-design.md`, plus
the "timed chord-tone targeting" bullet of the Whistler integration plan's
Phase 4 ("Rhythm").

## Goal

The most direct improvisation drill: a progression loops, and on every chord
change the player plays (or clicks) the requested chord tone, as close as
possible to the note they just played. Small moves between chords are voice
leading.

## Progressions and chords

`music/progressions.ts` holds the four progressions as Roman numerals in a
major key. Every chord is a 7th chord, so the 3rd and 7th always exist:

| Progression | Chords (one bar each) |
|---|---|
| I–IV–V | Imaj7 IVmaj7 V7 |
| ii–V–I | iim7 V7 Imaj7 |
| 12-bar blues | I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7 |
| I–vi–IV–V | Imaj7 vim7 IVmaj7 V7 |

Consecutive repeats are merged into one chord lasting several bars (the blues
becomes I7×4, IV7×2, I7×2, V7, IV7, I7, V7). A prompt is a real chord change,
so the loop never asks for the same chord twice in a row.

- **Key:** a fixed note, or random. A random key is drawn at the start and
  re-drawn each time the progression loops round. Only major keys (the blues
  uses dominant 7ths).

## Targets (`target`)

- `any`: any chord tone (root, 3rd, 5th or 7th) **except the previous
  answer's pitch class**. A held common tone isn't a change, so the player
  has to move.
- `3rd`, `7th`: that tone of the current chord. Holding it is allowed when the
  previous note is already the answer.
- `guide`: alternate 3rd and 7th, starting on the 3rd, by prompt count across
  loops. In ii–V–I this produces the textbook guide-tone line (F→F→E, C→B→B).

## Judging

- **Nearest-position rule:** the accepted answer is the occurrence of a target
  note nearest the previous answer. `closestPositionOf` in `music/notes.ts` now
  takes a note or a list of notes, so `any` picks the nearest of several chord
  tones. The closest-position algorithm setting applies.
- The first prompt starts from a random position, shown highlighted. After
  that, the origin is the previous answer: where the player played it if it
  was right, or the expected position if it was wrong or missed. That keeps
  the chain going.
- One answer per chord.
- **Mic:** the heard pitch is right when its pitch class is a target and it can
  be played within `MIC_NEAR_FRETS` = 3 frets of an expected position. The mic
  can't tell strings, so it is more lenient than clicking: another target in
  the same position, or the target an octave away in the same position,
  counts. The next origin is the heard pitch's position nearest the expected
  one.

## Tempo

- **Untimed** (default): a right click advances after a short beat. A wrong
  one shows the answer and waits for a click (or 1.6s with the mic).
- **Timed:** a shared `audio/metronome.ts` count-in of one 4/4 bar, then each
  chord lasts `barsPerChord` bars (1 or 2) times its merged length. The BPM is
  set on the start screen (40–200, default 80). A change with no answer
  counts as a miss, with the chord's full duration as its time.
- **Latency:** with the mic, the judging boundary of each change is moved by
  the shared calibration offset (`loadCalibMs()`, the `whistler.calib` value
  set in Ideate). The offset is negative when input arrives late. A note
  heard up to |offset| ms after the change was played before it, so it still
  counts for the old chord. The board and backing change on the beat; only
  the judging cut-over is delayed. Clicks have no input latency, so the
  offset isn't used for them.
- A session opened straight from a URL has had no click yet, so the browser
  keeps the AudioContext suspended. The header then says "Click anywhere to
  start the count-in".
- Pausing stops the metronome. On resume there is a new count-in, and the
  unanswered chord carries on rather than counting as a miss.

## Backing (`backing`)

- `chord` (default): the chord is plucked with the pluck synth, low and
  arpeggiated quickly, on each change.
- `drone`: the chord root drones (`audio/drone.ts`), restarted on each change.
- `off`.

"Play notes" (`playSound`) plucks the clicked note as in the other exercises.

## Report

Two tables: per chord degree (I, IV, V7, ii…, keyed by numeral) and per target
type (any / 3rd / 7th; guide-tone prompts count as 3rd or 7th). Both use
`aggregateGrouped`. The usual totals and attempt-time scatter are included.

## Plumbing

- Exercise id `chord-tones`, new "Chord-Tone Targeting" card in the Chords
  group.
- URL: `ex=chord-tones&prog=…&keyroot=…&tgt=…&back=…&tempo=untimed|timed&bpm=…&bars=…&algo=…&input=…&sens=…`
  plus the usual duration/frets/fretnums/sound. Missing params use the
  defaults.
- Prefs: `progression`, `toneTarget`, `backing`, `tempo`, `bpm`,
  `barsPerChord`. Key root, the closest-position algorithm and the mic
  settings are shared with the other cards.

## Deferred

- Approach notes and enclosures (a later variant, listed in the roadmap's
  gaps).
- Minor keys and minor blues.
- Scoring onset error in ms (the timed mode only checks which chord a note
  lands in).
