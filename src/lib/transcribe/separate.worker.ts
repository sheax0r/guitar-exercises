// Runs Demucs (onnxruntime-web, lazy-loaded from the CDN) off the main thread: each segment
// is seconds of synchronous WASM, which froze the page when it ran in the window.
// Single-threaded on purpose: no SharedArrayBuffer, so no COOP/COEP headers, so any static host works.
// In: { left, right, stem }. Out: { progress } messages, then { mono } or { error }.
const ORT_VER = '1.20.1';
const DEMUCS_URL = 'https://cdn.jsdelivr.net/npm/demucs-web@1.0.2/+esm';
// CDN modules with no local types.
let demucsProc: any = null;
const progress = (p: number) => postMessage({ progress: p });

async function processor() {
  if (demucsProc) return demucsProc;
  const ort = await import(/* @vite-ignore */ `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/+esm`);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/`;
  const demucs = await import(/* @vite-ignore */ DEMUCS_URL);
  const proc = new demucs.DemucsProcessor({
    ort,
    onDownloadProgress: (l: number, t: number) => { if (t) progress((0.4 * l) / t); }, // 0..0.4 = model download
    onProgress: ({ progress: p }: { progress?: number }) => progress(0.4 + 0.6 * (p || 0)) // 0.4..1 = separation
  });
  await proc.loadModel(demucs.CONSTANTS.DEFAULT_MODEL_URL);
  return (demucsProc = proc); // only after load resolves, so a failed download can be retried
}

onmessage = async (e: MessageEvent<{ left: Float32Array; right: Float32Array; stem: string }>) => {
  try {
    const { left, right, stem } = e.data;
    const res = await (await processor()).separate(left, right);
    const s = res[stem] || res.other;
    const mono = new Float32Array(s.left.length);
    for (let i = 0; i < mono.length; i++) mono[i] = (s.left[i] + (s.right ? s.right[i] : s.left[i])) / 2;
    postMessage({ mono }, { transfer: [mono.buffer] });
  } catch (err) {
    postMessage({ error: String(err) });
  }
};
