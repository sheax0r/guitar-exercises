// Shared, lazily-created AudioContext singleton used by every audio helper
// (pluck, drone, sequence, pitch). Returns null in headless/unsupported
// environments so callers can no-op silently.

let ctx: AudioContext | null = null;
let ctxFailed = false;

export function getAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  if (ctxFailed) return null;
  if (typeof window === 'undefined') {
    ctxFailed = true;
    return null;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    ctxFailed = true;
    return null;
  }
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    ctxFailed = true;
    return null;
  }
}
