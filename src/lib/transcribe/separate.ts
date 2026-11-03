// Source separation (Demucs, ~172 MB model cached by the browser after first use). The work
// runs in separate.worker.ts so the page stays responsive; one worker is kept so the
// model loads once per page.
import { resampleTo } from './basicPitch';

export type Stem = 'other' | 'vocals' | 'bass' | 'drums';

let worker: Worker | null = null;

export async function separate(audio: AudioBuffer, stem: Stem, onProg?: (p: number) => void): Promise<AudioBuffer> {
  const sr = 44100;
  const left = resampleTo(audio.getChannelData(0), audio.sampleRate, sr).slice();
  const right = audio.numberOfChannels > 1 ? resampleTo(audio.getChannelData(1), audio.sampleRate, sr).slice() : left.slice();
  worker ??= new Worker(new URL('./separate.worker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  const mono = await new Promise<Float32Array>((resolve, reject) => {
    w.onmessage = (e: MessageEvent<{ progress?: number; mono?: Float32Array; error?: string }>) => {
      if (e.data.mono) resolve(e.data.mono);
      else if (e.data.error) reject(new Error(e.data.error));
      else if (e.data.progress != null) onProg?.(e.data.progress);
    };
    w.onerror = e => {
      worker = null; // a crashed worker can't be reused; the next job starts a fresh one
      reject(new Error(e.message || 'separation worker failed'));
    };
    w.postMessage({ left, right, stem }, [left.buffer, right.buffer]);
  });
  const out = new AudioBuffer({ length: mono.length, sampleRate: sr, numberOfChannels: 1 });
  out.copyToChannel(mono as Float32Array<ArrayBuffer>, 0);
  return out;
}
