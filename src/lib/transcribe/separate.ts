// Source separation (Demucs via onnxruntime-web), lazy-loaded from the CDN (~172 MB model,
// cached by the browser after first use). Single-threaded on purpose: no SharedArrayBuffer,
// so no COOP/COEP headers, so any static host works.
import { resampleTo } from './basicPitch';

export type Stem = 'other' | 'vocals' | 'bass' | 'drums';

const ORT_VER = '1.20.1';
const DEMUCS_URL = 'https://cdn.jsdelivr.net/npm/demucs-web@1.0.2/+esm';
// CDN modules with no local types.
let ortMod: any = null, demucsMod: any = null, demucsProc: any = null;
let progCb: ((p: number) => void) | undefined;

export async function separate(audio: AudioBuffer, stem: Stem, onProg?: (p: number) => void): Promise<AudioBuffer> {
  progCb = onProg;
  ortMod = ortMod || (await import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/+esm`));
  ortMod.env.wasm.numThreads = 1;
  ortMod.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
  demucsMod = demucsMod || (await import(/* @vite-ignore */ DEMUCS_URL));
  if (!demucsProc) {
    const proc = new demucsMod.DemucsProcessor({
      ort: ortMod,
      onDownloadProgress: (l: number, t: number) => { if (t) progCb?.((0.4 * l) / t); }, // 0..0.4 = model download
      onProgress: ({ progress }: { progress?: number }) => progCb?.(0.4 + 0.6 * (progress || 0)) // 0.4..1 = separation
    });
    await proc.loadModel(demucsMod.CONSTANTS.DEFAULT_MODEL_URL);
    demucsProc = proc; // only after load resolves, so a failed download can be retried
  }
  const sr = 44100;
  let L: Float32Array = audio.getChannelData(0), R: Float32Array | null = audio.numberOfChannels > 1 ? audio.getChannelData(1) : null;
  if (audio.sampleRate !== sr) {
    L = resampleTo(L, audio.sampleRate, sr);
    R = R ? resampleTo(R, audio.sampleRate, sr) : null;
  }
  const res = await demucsProc.separate(L, R || L);
  const s = res[stem] || res.other;
  const mono = new Float32Array(s.left.length);
  for (let i = 0; i < mono.length; i++) mono[i] = (s.left[i] + (s.right ? s.right[i] : s.left[i])) / 2;
  const out = new AudioBuffer({ length: mono.length, sampleRate: sr, numberOfChannels: 1 });
  out.copyToChannel(mono, 0);
  return out;
}
