import { describe, it, expect } from 'vitest';
import { PlayShapeExercise } from './PlayShapeExercise';
import type { PlayShapeConfig } from './types';
import { octaveFixedPositions, boxPositions } from './shape';
import { pitchOf, noteAt } from '../../music/notes';
import { scaleNotes } from '../../music/modes';

const base: PlayShapeConfig = {
  exercise: 'play-shape',
  enabledModes: ['ionian'],
  shapeVariant: 'octave',
  octaveJudge: 'fixed',
  boxSpan: 4,
  maxFret: 24,
  durationSec: 300,
  continuous: true,
  showFretNumbers: true,
  playSound: false,
  drone: false,
  highlightCharacteristic: false,
  fixedRootNote: null,
  inputMode: 'click',
  micSensitivity: 0.5,
  micDeviceId: null,
  displayNotePercentage: 100
};

describe('PlayShapeExercise scale overlay', () => {
  it('visiblePositions holds the full scale at 100% and none at 0%', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, displayNotePercentage: 100 });
    const full = ex.getNextPrompt();
    const classes = new Set(scaleNotes(full.rootNote, full.mode));
    expect(full.visiblePositions.length).toBeGreaterThan(0);
    for (const p of full.visiblePositions) {
      expect(classes.has(noteAt(p.string, p.fret))).toBe(true);
    }
    ex.start({ ...base, displayNotePercentage: 0 });
    expect(ex.getNextPrompt().visiblePositions).toHaveLength(0);
  });
});

describe('PlayShapeExercise octave/fixed', () => {
  it('accepts the canonical sequence and completes on the last click', () => {
    const ex = new PlayShapeExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    expect(p.expectedCount).toBe(seq.length);
    for (let i = 0; i < seq.length; i++) {
      const r = ex.submitAnswer(seq[i]);
      expect(r.correct).toBe(true);
      expect(r.promptComplete).toBe(i === seq.length - 1);
    }
  });

  it('a wrong click does not advance or complete the prompt', () => {
    const ex = new PlayShapeExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    ex.submitAnswer(seq[0]);
    const wrong = { string: seq[1].string, fret: (seq[1].fret + 1) % 25 };
    const r = ex.submitAnswer(wrong);
    expect(r.correct).toBe(false);
    expect(r.promptComplete).toBe(false);
    // The next expected step still accepts the right note.
    expect(ex.submitAnswer(seq[1]).correct).toBe(true);
  });

  it('report aggregates per mode and marks a clean run correct', () => {
    const ex = new PlayShapeExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    seq.forEach(s => ex.submitAnswer(s));
    const rep = ex.getReport();
    expect(rep.totalPrompts).toBe(1);
    expect(rep.correctCount).toBe(1);
    expect(rep.perModeStats.find(s => s.mode === p.mode)!.timesAsked).toBe(1);
  });

  it('a prompt with any wrong click is recorded incorrect', () => {
    const ex = new PlayShapeExercise();
    ex.start(base);
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    const wrong = { string: seq[1].string, fret: (seq[1].fret + 1) % 25 };
    ex.submitAnswer(seq[0]);
    ex.submitAnswer(wrong);
    seq.slice(1).forEach(s => ex.submitAnswer(s));
    const rep = ex.getReport();
    expect(rep.totalPrompts).toBe(1);
    expect(rep.correctCount).toBe(0);
  });
});

describe('PlayShapeExercise octave reachability', () => {
  it('never emits a root whose octave cannot fit maxFret', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, maxFret: 5 });
    for (let i = 0; i < 50; i++) {
      const p = ex.getNextPrompt();
      const seq = octaveFixedPositions(p.root, p.mode, 5);
      expect(seq).not.toBeNull();
      seq!.forEach(s => ex.submitAnswer(s));
    }
  });
});

describe('PlayShapeExercise infeasible configs', () => {
  it('throws instead of hanging when the box span makes every shape empty', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, shapeVariant: 'box', boxSpan: 0 });
    expect(() => ex.getNextPrompt()).toThrow();
  });

  it('throws instead of hanging when no root can fit an octave (maxFret 1)', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, shapeVariant: 'octave', octaveJudge: 'fixed', maxFret: 1 });
    expect(() => ex.getNextPrompt()).toThrow();
  });
});

describe('PlayShapeExercise box', () => {
  it('completes only when every box position is clicked, any order', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, shapeVariant: 'box' });
    const p = ex.getNextPrompt();
    const set = boxPositions(p.root, p.mode, 24, 4);
    expect(p.expectedCount).toBe(set.length);
    for (let i = 0; i < set.length; i++) {
      const r = ex.submitAnswer(set[i]);
      expect(r.correct).toBe(true);
      expect(r.promptComplete).toBe(i === set.length - 1);
    }
  });

  it('clicking an already-clicked box position is wrong and does not complete', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, shapeVariant: 'box' });
    const p = ex.getNextPrompt();
    const set = boxPositions(p.root, p.mode, 24, 4);
    ex.submitAnswer(set[0]);
    const r = ex.submitAnswer(set[0]);
    expect(r.correct).toBe(false);
    expect(r.promptComplete).toBe(false);
  });
});

describe('PlayShapeExercise fixed root (parallel framing)', () => {
  it('every prompt uses the configured root note; mode still varies', () => {
    const ex = new PlayShapeExercise();
    ex.start({
      ...base,
      enabledModes: ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
      shapeVariant: 'octave',
      octaveJudge: 'pitch',
      fixedRootNote: 'G'
    });
    const modesSeen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = ex.getNextPrompt();
      expect(p.rootNote).toBe('G');
      modesSeen.add(p.mode);
    }
    expect(modesSeen.size).toBeGreaterThan(1);
  });

  it('null fixedRootNote keeps random roots (not all identical)', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, octaveJudge: 'pitch', fixedRootNote: null });
    const roots = new Set<string>();
    for (let i = 0; i < 40; i++) roots.add(ex.getNextPrompt().rootNote);
    expect(roots.size).toBeGreaterThan(1);
  });
});

describe('PlayShapeExercise octave/pitch mic', () => {
  it('submitMicNote advances on the expected pitch and completes on the last', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, octaveJudge: 'pitch', inputMode: 'mic' });
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    for (let i = 0; i < seq.length; i++) {
      const r = ex.submitMicNote(pitchOf(seq[i].string, seq[i].fret));
      expect(r.correct).toBe(true);
      expect(r.promptComplete).toBe(i === seq.length - 1);
    }
  });

  it('submitMicNote rejects a wrong pitch without advancing', () => {
    const ex = new PlayShapeExercise();
    ex.start({ ...base, octaveJudge: 'pitch', inputMode: 'mic' });
    const p = ex.getNextPrompt();
    const seq = octaveFixedPositions(p.root, p.mode, 24)!;
    const expected = pitchOf(seq[0].string, seq[0].fret);
    const r = ex.submitMicNote(expected + 1); // a semitone off
    expect(r.correct).toBe(false);
    expect(r.promptComplete).toBe(false);
  });
});

describe('PlayShapeExercise box + mic', () => {
  const boxMic = {
    ...base,
    shapeVariant: 'box' as const,
    boxSpan: 4,
    enabledModes: ['ionian' as const],
    inputMode: 'mic' as const
  };

  it('completes when every box note is played, claiming low-to-high on duplicates', () => {
    const ex = new PlayShapeExercise();
    ex.start(boxMic);
    const p = ex.getNextPrompt();
    const set = boxPositions(p.root, p.mode, 24, 4);
    // Feed each box note's pitch in ascending order; each claims the lowest
    // un-taken occurrence of its pitch class, so duplicates fill bottom-up.
    const sorted = [...set].sort((a, b) => pitchOf(a.string, a.fret) - pitchOf(b.string, b.fret));
    for (let i = 0; i < sorted.length; i++) {
      const r = ex.submitMicNote(pitchOf(sorted[i].string, sorted[i].fret));
      expect(r.correct).toBe(true);
      expect(r.promptComplete).toBe(i === sorted.length - 1);
    }
  });

  it('a note outside the box window is wrong and does not complete', () => {
    const ex = new PlayShapeExercise();
    ex.start(boxMic);
    const p = ex.getNextPrompt();
    const set = boxPositions(p.root, p.mode, 24, 4);
    const inBox = new Set(set.map(x => pitchOf(x.string, x.fret) % 12));
    let badPc = 0;
    while (inBox.has(badPc) && badPc < 12) badPc++;
    const r = ex.submitMicNote(60 - (60 % 12) + badPc); // a midi with that absent pitch class
    expect(r.correct).toBe(false);
    expect(r.promptComplete).toBe(false);
  });
});
