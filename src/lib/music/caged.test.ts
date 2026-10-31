import { describe, it, expect } from 'vitest';
import {
  CAGED_SHAPES,
  cagedInstances,
  chordName,
  chordNotes,
  chordPositions,
  chordTypesFor,
  nextShapeInstance,
  type CagedShape,
  type ChordType
} from './caged';
import type { Note } from './notes';
import type { StringNum } from './tuning';

// Open-chord voicing as a "x32010"-style string, low E (string 6) first.
function voicing(v: string): Array<{ string: StringNum; fret: number }> {
  return [...v].flatMap((c, i) =>
    c === 'x' ? [] : [{ string: (6 - i) as StringNum, fret: Number(c) }]
  );
}

const key = (p: { string: number; fret: number }) => `${p.string}/${p.fret}`;

function openInstance(shape: CagedShape, root: Note) {
  const inst = cagedInstances(shape, root, 24)[0];
  expect(inst).toBeDefined();
  return inst;
}

describe('CAGED windows — open-chord sanity', () => {
  const cases: Array<[CagedShape, Note, number, number, [number, number]]> = [
    ['C', 'C', 5, 3, [0, 3]],
    ['A', 'A', 5, 0, [0, 2]],
    ['G', 'G', 6, 3, [0, 3]],
    ['E', 'E', 6, 0, [0, 2]],
    ['D', 'D', 4, 0, [0, 3]]
  ];
  for (const [shape, root, string, fret, window] of cases) {
    it(`${shape} shape of ${root}: root ${string}/${fret}, window ${window.join('-')}`, () => {
      const inst = openInstance(shape, root);
      expect(inst.root).toEqual({ string, fret });
      expect(inst.window).toEqual(window);
    });
  }

  // Every open voicing's fretted notes must fall in the shape's window.
  const voicings: Array<[CagedShape, Note, ChordType, string]> = [
    ['C', 'C', 'maj', 'x32010'], ['C', 'C', 'maj7', 'x32000'], ['C', 'C', '7', 'x32310'],
    ['A', 'A', 'maj', 'x02220'], ['A', 'A', 'min', 'x02210'], ['A', 'A', 'maj7', 'x02120'],
    ['A', 'A', '7', 'x02020'], ['A', 'A', 'm7', 'x02010'],
    ['G', 'G', 'maj', '320003'], ['G', 'G', 'maj7', '320002'], ['G', 'G', '7', '320001'],
    ['E', 'E', 'maj', '022100'], ['E', 'E', 'min', '022000'], ['E', 'E', 'maj7', '021100'],
    ['E', 'E', '7', '020100'], ['E', 'E', 'm7', '020000'],
    ['D', 'D', 'maj', 'xx0232'], ['D', 'D', 'min', 'xx0231'], ['D', 'D', 'maj7', 'xx0222'],
    ['D', 'D', '7', 'xx0212'], ['D', 'D', 'm7', 'xx0211']
  ];
  for (const [shape, root, type, v] of voicings) {
    it(`${shape} shape of ${root}${type} contains ${v}`, () => {
      const inst = openInstance(shape, root);
      const got = new Set(chordPositions(root, type, inst.window).map(key));
      for (const p of voicing(v)) expect(got.has(key(p))).toBe(true);
    });
  }
});

describe('cagedInstances', () => {
  it('moves a window that would start below fret 0 up an octave', () => {
    // C shape of A: root 5/0 would need frets -3..0, so it sits at 5/12.
    const [inst] = cagedInstances('C', 'A', 24);
    expect(inst.root).toEqual({ string: 5, fret: 12 });
    expect(inst.window).toEqual([9, 12]);
  });

  it('rejects windows past maxFret', () => {
    expect(cagedInstances('C', 'A', 11)).toEqual([]);
    expect(cagedInstances('E', 'E', 24).map(i => i.root.fret)).toEqual([0, 12]);
    expect(cagedInstances('E', 'E', 13).map(i => i.root.fret)).toEqual([0]);
  });

  it('uses each shape table entry', () => {
    expect(Object.keys(CAGED_SHAPES).sort()).toEqual(['A', 'C', 'D', 'E', 'G']);
  });
});

describe('chords', () => {
  it('spells triads and 7ths', () => {
    expect(chordNotes('C', 'maj')).toEqual(['C', 'E', 'G']);
    expect(chordNotes('A', 'min')).toEqual(['A', 'C', 'E']);
    expect(chordNotes('G', '7')).toEqual(['G', 'B', 'D', 'F']);
    expect(chordNotes('C', 'maj7')).toEqual(['C', 'E', 'G', 'B']);
    expect(chordNotes('D', 'm7')).toEqual(['D', 'F', 'A', 'C']);
  });

  it('names chords', () => {
    expect(chordName('A', 'maj')).toBe('A major');
    expect(chordName('D', 'm7')).toBe('Dm7');
  });

  it('builds the chord-type pool from qualities and the 7th toggle', () => {
    expect(chordTypesFor(['major', 'minor'], false)).toEqual(['maj', 'min']);
    expect(chordTypesFor(['major'], true)).toEqual(['maj7', '7']);
    expect(chordTypesFor(['minor'], true)).toEqual(['m7']);
  });
});

describe('nextShapeInstance', () => {
  // The C chord tiles the neck C(0) → A(3) → G(5) → E(8) → D(10) → C(12).
  it('walks the C-A-G-E-D cycle up the neck', () => {
    let inst = cagedInstances('C', 'C', 24)[0];
    const seen: string[] = [`${inst.shape}${inst.window[0]}`];
    for (let i = 0; i < 5; i++) {
      inst = nextShapeInstance(inst, 'C', 24)!;
      seen.push(`${inst.shape}${inst.window[0]}`);
    }
    expect(seen).toEqual(['C0', 'A3', 'G5', 'E8', 'D10', 'C12']);
  });

  it('returns null when the next shape does not fit', () => {
    const d = cagedInstances('D', 'C', 13)[0];
    expect(nextShapeInstance(d, 'C', 13)).toBeNull();
  });
});
