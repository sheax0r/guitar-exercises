// Learn mic judging against real guitar (GuitarSet). The fixtures are fetched by
// test/fetch_fixtures.py and gitignored, so each case skips when its files are missing (CI).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listenOffline } from '../../audio/pitch';
import { LEARN_EXPECT, LEARN_FIXTURES, jamsNotes, scoreLearn } from './learn';

const TEST_DIR = resolve(__dirname, '../../../../test');

// Minimal WAV reader: 16-bit PCM, first channel.
function readWav(path: string): { data: Float32Array; sampleRate: number } {
  const b = readFileSync(path), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 12, ch = 1, sampleRate = 44100, bits = 16;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), len = v.getUint32(p + 4, true);
    if (id === 'fmt ') { ch = v.getUint16(p + 10, true); sampleRate = v.getUint32(p + 12, true); bits = v.getUint16(p + 22, true); }
    if (id === 'data') {
      if (bits !== 16) throw new Error(`unsupported WAV: ${bits}-bit`);
      const n = Math.floor(len / 2 / ch), data = new Float32Array(n);
      for (let i = 0; i < n; i++) data[i] = v.getInt16(p + 8 + i * 2 * ch, true) / 32768;
      return { data, sampleRate };
    }
    p += 8 + len + (len % 2);
  }
  throw new Error('no data chunk');
}

describe('scoreLearn', () => {
  it('matches pitch within the note window and ignores short notes', () => {
    const annot = [{ midi: 60, start: 1, dur: 0.5 }, { midi: 62, start: 2, dur: 0.05 }, { midi: 64, start: 3, dur: 0.3 }];
    const s = scoreLearn([{ midi: 60, t: 1.1 }, { midi: 62, t: 2.02 }, { midi: 65, t: 3.1 }], annot);
    expect(s).toEqual({ nExp: 2, nDet: 3, recall: 0.5, precision: 2 / 3 });
  });
});

describe('Learn mic judging on GuitarSet', () => {
  for (const fx of LEARN_FIXTURES) {
    const wav = resolve(TEST_DIR, fx.file!), jams = resolve(TEST_DIR, fx.annot!.file);
    it.skipIf(!existsSync(wav) || !existsSync(jams))(fx.id, () => {
      const { data, sampleRate } = readWav(wav);
      const s = scoreLearn(listenOffline(data, sampleRate), jamsNotes(readFileSync(jams, 'utf8')));
      console.log(fx.id, JSON.stringify(s));
      expect(s.recall).toBeGreaterThanOrEqual(LEARN_EXPECT[fx.id].recall);
      expect(s.precision).toBeGreaterThanOrEqual(LEARN_EXPECT[fx.id].precision);
    });
  }
});
