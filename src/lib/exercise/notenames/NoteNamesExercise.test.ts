import { describe, it, expect } from 'vitest';
import { NoteNamesExercise, parseNoteName } from './NoteNamesExercise';
import type { NoteNamesConfig } from './types';
import { noteAt, pitchOf } from '../../music/notes';

const base: NoteNamesConfig = {
  exercise: 'note-names',
  noteVariant: 'name',
  strings: [6, 5],
  inputMode: 'click',
  micSensitivity: 0.5,
  micDeviceId: null,
  maxFret: 12,
  durationSec: 300,
  continuous: true,
  showFretNumbers: true,
  playSound: false
};

describe('parseNoteName', () => {
  it('reads naturals, sharps, flats and enharmonics', () => {
    expect(parseNoteName('a')).toBe('A');
    expect(parseNoteName(' C# ')).toBe('C#');
    expect(parseNoteName('db')).toBe('C#');
    expect(parseNoteName('E♭')).toBe('D#');
    expect(parseNoteName('Cb')).toBe('B');
    expect(parseNoteName('E#')).toBe('F');
    expect(parseNoteName('B flat')).toBe('A#');
    expect(parseNoteName('H')).toBeNull();
    expect(parseNoteName('')).toBeNull();
  });
});

describe('NoteNamesExercise', () => {
  it('name: highlights a fret on a chosen string; the answer is its note', () => {
    const ex = new NoteNamesExercise();
    ex.start(base);
    for (let i = 0; i < 50; i++) {
      const p = ex.getNextPrompt();
      expect([6, 5]).toContain(p.highlight.string);
      expect(p.note).toBe(noteAt(p.highlight.string, p.highlight.fret));
      const wrong = p.note === 'C' ? 'D' : 'C';
      expect(ex.submitAnswer({ note: i % 2 ? p.note : wrong }).correct).toBe(i % 2 === 1);
    }
    const r = ex.getReport();
    expect(r.totalPrompts).toBe(50);
    expect(r.correctCount).toBe(25);
  });

  it('play: any fret on the asked string with that note counts; other strings do not', () => {
    const ex = new NoteNamesExercise();
    ex.start({ ...base, noteVariant: 'play', strings: [6] });
    for (let i = 0; i < 30; i++) {
      const p = ex.getNextPrompt();
      expect(p.accepted.every(a => a.string === 6 && noteAt(6, a.fret) === p.note)).toBe(true);
      const last = p.accepted[p.accepted.length - 1];
      expect(ex.submitAnswer(last).correct).toBe(true);
      ex.getNextPrompt();
      expect(ex.submitAnswer({ string: 1, fret: 0 }).correct).toBe(false);
    }
  });

  it('play by mic: the exact pitch of an accepted fret counts, the wrong octave does not', () => {
    const ex = new NoteNamesExercise();
    ex.start({ ...base, noteVariant: 'play', strings: [5], maxFret: 5 });
    const p = ex.getNextPrompt();
    expect(ex.submitAnswer({ midi: pitchOf(5, p.accepted[0].fret) }).correct).toBe(true);
    const q = ex.getNextPrompt();
    expect(ex.submitAnswer({ midi: pitchOf(5, q.accepted[0].fret) + 12 }).correct).toBe(false);
  });
});
