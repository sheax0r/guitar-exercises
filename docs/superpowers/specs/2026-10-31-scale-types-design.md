# Scale Types Beyond the Modes — Design

Date: 2026-10-31
Status: shipped. Item 4 of `2026-10-31-improvisation-roadmap-design.md`.

## Goal

Play the Shape and Identify the Mode drill more than the seven modes: major and
minor pentatonic, blues, harmonic minor and melodic minor. Play the Shape gains a
CAGED position variant, and mic input works for every windowed variant.

## Scale model

- `music/modes.ts` adds `ScaleType = Mode | 'major-pentatonic' |
  'minor-pentatonic' | 'blues' | 'harmonic-minor' | 'melodic-minor'`. `Mode`
  stays the seven modes.
- The existing tables (`MODE_OFFSETS`, `MODE_DISPLAY`, `MODE_CHARACTERISTIC`)
  are keyed by `ScaleType`; `SCALE_ORDER` is the modes followed by the new five.
  The exercises only ever use a scale's pitch-class set, so nothing else in the
  engine changed. The octave run is root…octave over however many degrees the
  scale has (6 notes for a pentatonic, 7 for blues).
- Characteristic notes for the new scales (teaching choices, each the tell
  against its nearest sibling): major pentatonic → 3, minor pentatonic → b3,
  blues → b5, harmonic minor → maj7, melodic minor → natural 6.
- `scaleFamily(scale)` is `major` when the scale has a major 3rd, else `minor`.

## CAGED shape variant (Play the Shape)

`shapeVariant: 'caged'`. Each prompt is a random scale, a random (or the fixed)
root note and a random C/A/G/E/D shape, placed at a random fitting position.
The player clicks every scale note in that position, in any order (box rules).

The chord windows from item 1 are too narrow for scales, so `caged.ts` adds
`CAGED_SCALE_WINDOWS`, one table per scale family, relative to the shape's root
fret (root strings are the item 1 ones):

| Shape | major family | minor family |
|---|---|---|
| C | −3 … 0 | −3 … +1 |
| A | −1 … +2 | 0 … +3 |
| G | −3 … 0 | −3 … 0 |
| E | −1 … +2 | 0 … +3 |
| D | −1 … +3 | 0 … +3 |

These reproduce the five textbook pentatonic boxes (major pentatonic off the
major shapes, minor pentatonic off the minor shapes, e.g. A minor pentatonic E
shape = frets 5–8). Tests check two notes per string in every position for
C/G major and A/E minor pentatonic. Seven-note scales of the family fill the
same frets. `cagedInstances` takes an optional window override so the item 1
placement logic (shift up 12 below fret 0, reject past `maxFret`) is reused.

The prompt reads "Blues from C, **D shape**"; the root marker sits on the
shape's root string.

## Mic

Box already accepted mic by pitch class (any order, a note claims its lowest
untaken occurrence). The CAGED variant uses the same path. Only the
fixed-fingering octave stays click-only.

## Settings, URL, prefs

- The modes chip group becomes two rows, "Modes" and "Other scales", over the
  same `enabledModes` list. Defaults stay the seven modes.
- Shape chips gain "CAGED position".
- URL: `modes=` accepts the new names; `variant=caged`. Old URLs and recents
  parse unchanged. `enabledModes` keeps its name (and the `modes` param) for
  compatibility even though it now holds any `ScaleType`.
- Summary: "All modes" when exactly the seven modes are on, "All scales" when
  all twelve are, otherwise "N modes"/"N scales" or the names; "CAGED" for the
  variant.

## Deviations / deferred

- No per-shape enable list for the CAGED variant (all five shapes are drawn);
  CAGED Shapes (item 1) has one if needed.
- The report stays per scale; no per-shape breakdown for the CAGED variant.
