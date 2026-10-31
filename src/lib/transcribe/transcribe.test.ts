// @vitest-environment node
// (node, not jsdom: jsdom's TextEncoder returns a foreign-realm Uint8Array that fflate rejects)
import { describe, it, expect } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { toSixteenths, durToken, largestPow2, mapNotes, firstMidi, tokSixteenths } from './quantize';
import { midiToFret, chordFrets, noteName } from './fretting';
import { buildTex, makeAudible } from './score';
import { detectNotes, estimateLag, cleanPoly } from './detect';
import { resampleTo } from './basicPitch';
import type { AudioLike, DetectSettings } from './types';

const audio = (data: Float32Array, sampleRate: number): AudioLike => ({ sampleRate, getChannelData: () => data });

describe('quantize', () => {
  it('converts seconds to 16ths and back to tokens', () => {
    expect(toSixteenths(60 / 120, 120)).toBe(4); // 1 beat @120 = 4 sixteenths
    expect(toSixteenths(0, 120)).toBe(1); // never 0
    expect(durToken(4)).toBe('4');
    expect(durToken(1)).toBe('16');
    expect(durToken(6)).toBe('4'); // single base value, no dots
    expect(tokSixteenths('3.2.8')).toBe(2);
    expect(largestPow2(6)).toBe(4);
    expect(largestPow2(0)).toBe(1);
  });

  it('maps relative to the anchor, keeping intervals', () => {
    const raw = [{ midiFloat: 88.1, start: 0, dur: 0.5 }, { midiFloat: 90.0, start: 0.5, dur: 0.5 }, { midiFloat: 85.2, start: 1, dur: 0.5 }];
    expect(mapNotes(raw, 57).map(n => n.midi)).toEqual([57, 59, 54]);
    expect(mapNotes(raw, 57, -0.2).map(n => n.start)).toEqual([0, 0.3, 0.8]); // offset, clamped at 0
  });

  it('rounds against the take tuning, not the (scooped) first note', () => {
    const flat = [{ midiFloat: 59.45, start: 0, dur: 0.1 }, { midiFloat: 61.6, start: 0, dur: 0.5 }, { midiFloat: 63.6, start: 0, dur: 0.5 }, { midiFloat: 59.6, start: 0, dur: 0.5 }];
    expect(firstMidi(flat)).toBe(60);
    expect(mapNotes(flat, firstMidi(flat)).map(n => n.midi)).toEqual([60, 62, 64, 60]); // C D E C
  });
});

describe('fretting', () => {
  it('picks the lowest fret', () => {
    expect(midiToFret(64)).toEqual({ str: 1, fret: 0 });
    expect(midiToFret(40)).toEqual({ str: 6, fret: 0 });
    expect(midiToFret(60)).toEqual({ str: 2, fret: 1 });
    expect(midiToFret(30)).toBeNull(); // below low E
  });

  it('voices near the previous fret when asked', () => {
    expect(chordFrets([62])[0].fret).toBe(3); // D4 -> B string f3
    expect(chordFrets([62], 10)[0]).toEqual({ str: 4, fret: 12 });
    expect(chordFrets([40, 47, 52]).map(f => f.str)).toEqual([6, 5, 4]); // each note on its own string
  });

  it('names notes', () => {
    expect(noteName(57)).toBe('A3');
    expect(noteName(88)).toBe('E6');
  });
});

describe('buildTex', () => {
  it('groups simultaneous onsets into a chord', () => {
    expect(buildTex([{ midi: 40, start: 0, dur: 0.5 }, { midi: 47, start: 0, dur: 0.5 }], 120, 4, 4)).toMatch(/\(\S+ \S+\)\./);
    expect(buildTex([{ midi: 40, start: 0, dur: 0.5 }, { midi: 47, start: 0.5, dur: 0.5 }], 120, 4, 4)).not.toMatch(/\(/);
  });

  it('ties a dotted length only with rhythm cleanup', () => {
    const n = [{ midi: 40, start: 0, dur: 0.75 }]; // 6 sixteenths @120
    expect(buildTex(n, 120, 4, 4, { rhythm: true })).toContain('0.6.4 -.6.8');
    expect(buildTex(n, 120, 4, 4)).not.toMatch(/-/);
  });

  it('splits long rests across bars', () => {
    const tex = buildTex([{ midi: 40, start: 0, dur: 0.5 }, { midi: 40, start: 4.5, dur: 0.5 }], 120, 4, 4);
    expect(tex).toBe('\\title "Whistle" \\tempo 120 \\ts 4 4 . 0.6.4 r.2 r.4 | r.1 | r.4 0.6.4');
  });
});

describe('makeAudible', () => {
  it('injects an RSE patch into the gpif', () => {
    const gpif = '<Sound><MIDI></MIDI></Sound><AudioEngineState>MIDI</AudioEngineState>';
    const out = strFromU8(unzipSync(makeAudible(zipSync({ 'Content/score.gpif': strToU8(gpif) })))['Content/score.gpif']);
    expect(out).toContain('<SoundbankPatch>D-Steel</SoundbankPatch>');
    expect(out).toContain('<AudioEngineState>RSE</AudioEngineState>');
  });

  it('returns the bytes unchanged when they are not a zip', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(makeAudible(bytes)).toBe(bytes);
  });
});

describe('estimateLag', () => {
  it('finds onsets 40ms after each beat -> about -40ms', () => {
    const sr = 1000, d = new Float32Array(2200);
    for (const t of [0.04, 0.54, 1.04, 1.54, 2.04]) for (let j = 0; j < 4; j++) d[Math.round(t * sr) + j] = 1;
    expect(Math.abs(estimateLag(d, sr, 0.5)! + 40)).toBeLessThanOrEqual(15);
  });

  it('returns null for silence or too few clicks', () => {
    expect(estimateLag(new Float32Array(2000), 1000, 0.5)).toBeNull();
    const d = new Float32Array(2000);
    d[100] = 1;
    expect(estimateLag(d, 1000, 0.5)).toBeNull();
  });
});

describe('detectNotes (pitchy)', () => {
  const S: DetectSettings = { engine: 'pitchy', instrument: 'whistle', clarity: 0.9, minMs: 90, mergeMs: 80 };
  const sr = 44100;
  // sine tones: [midi, start s, dur s]
  function tones(spec: Array<[number, number, number]>): Float32Array {
    const out = new Float32Array(Math.ceil((Math.max(...spec.map(([, s, d]) => s + d)) + 0.3) * sr));
    for (const [m, s, d] of spec) {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      for (let k = 0; k < d * sr; k++) out[Math.round(s * sr) + k] = 0.4 * Math.sin((2 * Math.PI * f * k) / sr) * Math.min(1, k / (0.01 * sr), (d * sr - k) / (0.01 * sr));
    }
    return out;
  }

  it('finds two sine tones with their pitch and timing', async () => {
    const notes = await detectNotes(audio(tones([[72, 0.1, 0.4], [76, 0.7, 0.4]]), sr), S);
    expect(notes.map(n => Math.round(n.midiFloat))).toEqual([72, 76]);
    expect(notes[0].start).toBeCloseTo(0.1, 1);
    expect(notes[1].start).toBeCloseTo(0.7, 1);
    expect(notes[1].dur).toBeCloseTo(0.4, 1);
  });

  it('drops tones outside the instrument range and shorter than minMs', async () => {
    const notes = await detectNotes(audio(tones([[48, 0.1, 0.4], [76, 0.7, 0.05]]), sr), S); // C3 below whistle range; 50ms blip
    expect(notes).toEqual([]);
  });
});

describe('cleanPoly', () => {
  it('drops a quieter octave ghost on guitar, keeps chord tones', () => {
    const notes = [
      { midiFloat: 40, start: 0, dur: 1, amp: 1 },
      { midiFloat: 52, start: 0, dur: 1, amp: 0.5 }, // octave ghost
      { midiFloat: 44, start: 0, dur: 1, amp: 0.9 } // chord tone
    ];
    expect(cleanPoly(notes, false).map(n => n.midiFloat)).toEqual([40, 44]);
  });

  it('keeps one note at a time for mono inputs, trimming legato overlap', () => {
    const notes = [
      { midiFloat: 60, start: 0, dur: 1.1, amp: 1 },
      { midiFloat: 62, start: 1, dur: 1, amp: 0.8 },
      { midiFloat: 67, start: 0.2, dur: 0.5, amp: 0.3 } // overlapping ghost
    ];
    const out = cleanPoly(notes, true);
    expect(out.map(n => n.midiFloat)).toEqual([60, 62]);
    expect(out[0].dur).toBeCloseTo(1);
  });
});

describe('resampleTo', () => {
  it('interpolates linearly', () => {
    expect(Array.from(resampleTo(new Float32Array([0, 1, 2, 3]), 2, 4))).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3]);
  });
});
