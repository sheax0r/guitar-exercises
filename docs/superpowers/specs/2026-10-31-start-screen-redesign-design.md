# Start Screen Redesign — Design

Status: approved by user 2026-10-31.

## Problem

`StartScreen.svelte` (537 lines) renders every setting for every exercise in one flat column. Exercise picked from an undescribed `<select>`; rarely-used toggles share equal weight with core choices; note picking uses three different patterns; short option lists alternate between chips and selects; label weight inconsistent; mic input disabled with a hint telling the user to change other settings; no quick way to repeat a common setup; Start button falls below the fold on modes exercises.

## Goals

1. **Exercise cards** replace the dropdown. Two groups:
   - *Fretboard*: **Root Notes** — "Find the nearest occurrence of a note."; **Intervals** — "Find the 3rd or 5th above a note, in key."
   - *Modes*: **Play the Shape** — "Play a mode as an octave run or position box."; **Identify the Mode** — "Name the mode from its notes or its sound."
   Random Roots stops being a card: it becomes the "A/E/D" target option of Root Notes. Internally the `random-roots` exercise kind, its config, URL format and prefs value are unchanged (old URLs and stored prefs keep working). Stored prefs `exercise: 'random-roots'` selects the Root Notes card with A/E/D chosen.
2. **Three tiers** of settings, top to bottom:
   - Exercise settings (only the selected exercise's).
   - Session: Duration, Frets.
   - `<details>` "More options" (closed by default): Show fret numbers, Play notes; fretboard exercises add Show all labels (warm-up mode), Show root note positions, Closest-position algorithm; modes exercises add Drone the root, Highlight the characteristic note, Show scale notes slider.
   Mic settings (sensitivity, input source) stay inline under Input when mic is chosen.
3. **One note picker**: a 12-note chip grid with an optional leading "random" chip. Used for Root Notes target (random chip label "A/E/D" → `random-roots`), Intervals key (random chip "Random"), Modes root (random chip "Random"). Every choice with ≤ 6 options uses chips; Interval (3rd / 5th / Random), Key quality (Major / Minor / Random), Direction (Nearest / Ascending), Algorithm (Same fret first / Manhattan), Shape, Judging, Input, Prompt all become chips. No `<select>` remains on the start screen except MicSettings' input-source list.
4. **Consistent labels**: every row heading uses the same bold `.label` style.
5. **Mic auto-switch**: "Play (mic)" is never disabled. Choosing it while Shape = One octave and Judging = Fixed fingering sets Judging to "Any position (by pitch)". Choosing Fixed fingering while mic is selected reverts Input to "Click the notes" (existing behavior). The "Mic input works with…" hint is removed.
6. **Sticky Start bar** pinned to the viewport bottom: one-line summary of the pending config plus the Start button. Page content gets bottom padding so the bar never covers the last control.
7. **Recent sessions**: the last 5 distinct started configs (stored as session hashes in prefs `recentSessions`) shown as chips above the cards, newest first, labelled with the same summary text. Clicking one starts that config immediately and moves it to the front. Invalid or unparseable stored hashes are silently skipped. Mic device id is not in the hash; a recent play-shape session uses the device currently stored in prefs.
8. **Code split**: per-exercise settings move into components under `src/lib/components/start/`; StartScreen keeps state, prefs, and config assembly. Chip styles move to global `app.css` so child components share them. README updated to list current exercises and the real layout.

## Summary text

`summarize(config)` joins parts with " · ":

- Name: Root Notes (both `root-notes` and `random-roots`), Intervals, Play the Shape, Identify the Mode.
- Root Notes: target note display (e.g. `C#`), or `A/E/D` for random-roots.
- Intervals: interval (`3rd`, `5th`, `3rd/5th` for random); key = `<root> <quality>` where root is the note display or `any key`, quality is `major`, `minor`, or `major/minor`.
- Modes: `All modes` when all 7 enabled; display names joined by ", " when ≤ 3; otherwise `<n> modes`. Play the Shape adds `Octave` or `Box (<span> frets)`, then `Mic` when input is mic. Identify adds `By ear` when prompt is audio.
- Duration: `Continuous`, `<n>m` when divisible by 60, else `<n>s`.
- Frets: `<n> frets`.

Examples: `Root Notes · A · 5m · 12 frets`; `Play the Shape · Dorian, Lydian · Box (4 frets) · Mic · Continuous · 24 frets`.

## Non-goals

No change to session, report, routing format, or exercise logic. No new dependencies. No visual theme work.
