// The fixture harness's scorer self-checks, plus the synthetic (always-available) fixtures run
// through pitchy end to end. Real-audio fixtures and Basic Pitch run in the browser harness
// (ideate-test.html), since they need fetched files, decodeAudioData and a CDN model.
import { describe, it, expect } from 'vitest';
import { detectNotes } from '../detect';
import { firstMidi, mapNotes } from '../quantize';
import { FIXTURES } from './fixtures';
import { scoreNotes, scoreAnnot } from './scoring';
import { synthMelody } from './synth';
import { HAPPY_BIRTHDAY, withPos } from './songs';

const exp = withPos(HAPPY_BIRTHDAY).map(n => ({ semi: n.semi, pos: n.pos }));

describe('scorer', () => {
  it('identity -> F1 1, onset 1, tempo recovered', () => {
    const perfect = exp.map(e => ({ midi: 67 + e.semi, start: 1 + e.pos * 0.6 }));
    const s = scoreNotes(perfect, exp);
    expect(s.f1).toBe(1);
    expect(s.onset).toBe(1);
    expect(Math.round(60 / s.tempoScale!)).toBe(100);
  });

  it('transposed, slower, one dropped and one extra -> F1 .96', () => {
    const moved = exp.map(e => ({ midi: 67 + e.semi - 17, start: (1 + e.pos * 0.6) * 1.3 + 0.2 }));
    moved.splice(5, 1);
    moved.push({ midi: 30, start: 3.3 });
    const s = scoreNotes(moved, exp);
    expect(s.f1).toBeCloseTo(0.96, 9);
    expect(s.onset).toBeCloseTo(24 / 25, 9);
  });

  it('nothing detected -> 0', () => expect(scoreNotes([], exp).f1).toBe(0));

  it('annotations need absolute pitch and time', () => {
    const ann = [60, 62, 64, 65, 67].map((m, i) => ({ semi: m, pos: i * 0.5 }));
    const hit = ann.map(e => ({ midi: e.semi, start: e.pos + 0.02 }));
    expect(scoreAnnot(hit, ann).f1).toBe(1);
    expect(scoreAnnot(hit.map(h => ({ ...h, midi: h.midi + 12 })), ann).f1).toBe(0);
    expect(scoreAnnot(hit.map(h => ({ ...h, start: h.start + 0.1 })), ann).f1).toBe(0);
  });
});

describe('synthetic fixtures (pitchy)', () => {
  for (const fx of FIXTURES.filter(f => f.synth)) {
    it(`${fx.id} meets its threshold`, async () => {
      const sr = 44100, data = synthMelody(HAPPY_BIRTHDAY, { ...fx.synth, sr });
      const raw = await detectNotes(
        { sampleRate: sr, getChannelData: () => data },
        { engine: 'pitchy', instrument: fx.instrument, clarity: 0.9, minMs: 90, mergeMs: 80 }
      );
      const s = scoreNotes(mapNotes(raw, firstMidi(raw)), exp);
      const th = fx.expect!.pitchy;
      expect(s.f1).toBeGreaterThanOrEqual(th.f1);
      expect(s.onset).toBeGreaterThanOrEqual(th.onset);
    });
  }
});
