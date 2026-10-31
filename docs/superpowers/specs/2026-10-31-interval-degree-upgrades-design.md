# Interval and Degree Upgrades — Design

Date: 2026-10-31
Status: shipped. Item 3 of `2026-10-31-improvisation-roadmap-design.md`.

## Goal

Train scale degrees relative to a key (skill layer 2) beyond the diatonic 3rd
and 5th: every generic interval, chromatic intervals from the key root, and
naming or finding a degree anywhere on the neck.

## Intervals

- `Interval` is now `'2nd' | '3rd' | '4th' | '5th' | '6th' | '7th'`
  (`INTERVAL_ORDER`). `diatonicInterval` just gains the extra degree offsets.
- **Multi-select.** `intervalKind: Interval | 'random'` became
  `intervals: Interval[]`; each prompt draws one. The old `'random'` meant the
  3rd/5th mix, which is now the default `['3rd', '5th']`, so defaults are
  unchanged. Chips on the start screen toggle each interval; Start is disabled
  when none is on.
- **Reference** `intervalRef: 'diatonic-from-note' | 'from-root'`:
  - `diatonic-from-note` (default, the old behaviour): a note of the key is
    shown, find the in-key interval above it.
  - `from-root`: a position of the key root is shown and the player finds a
    chromatic interval above it ("Find the b7 of D"). Each generic interval has
    two flavours (`CHROMATIC_INTERVALS`): b2/2, b3/3, 4/#4, b5/5, b6/6, b7/7.
    Key quality is ignored (and hidden) here. Compound names (b9) are left out:
    they are the same pitch class as b2 on a single-note drill.
  - Answers use the same nearest-position rule and direction setting as before.
- URL: `int` is a comma list (`int=2nd,7th`); the legacy `int=random`, `int=3rd`
  and a missing `int` still parse. `iref=diatonic|root`, default diatonic.
  Prefs keep reading the legacy `intervalKind` when `intervals` is absent.

## Name the Degree (new card, Fretboard group)

A sibling card rather than an Intervals variant: its forward drill answers with
buttons, not the fretboard, so it doesn't fit `FretboardSession`.

- Config `degrees`: `degreeVariant: 'name' | 'find'`, `keyRoot` (fixed or
  random, shared pref with Intervals), the closest-position algorithm, and the
  usual duration/frets/sound options.
- Degrees are the twelve `DEGREE_LABELS` 1, b2, 2, b3, 3, 4, #4, 5, b6, 6, b7, 7
  (`degreeOf(root, note)`); the tritone is called #4.
- **name (forward):** a random position is highlighted (unlabelled); the header
  names the key; the player picks a degree button. The note is revealed after
  answering.
- **find (reverse):** a random start position is highlighted and the prompt says
  "Find the b7 of D, nearest the highlighted note". Correct = one of
  `closestPositionOf(target, start, maxFret, algorithm, 'nearest')`. The start
  is never the target note itself. A miss shows the nearest answer(s).
- One answer per prompt. The report is per degree (sorted 1…7), reusing the
  per-group table of the modes/CAGED reports.
- URL: `ex=degrees&dvar=name|find&keyroot=<note|random>&algo=…`.

## Deviations / deferred

- No mic for Name the Degree or Intervals (unchanged from before).
- No per-degree enable list; all twelve degrees are drawn.
