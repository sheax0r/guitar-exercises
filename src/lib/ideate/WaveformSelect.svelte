<script lang="ts">
  // Waveform of the open take; drag across it to pick a region to re-transcribe.
  let { buffer, onTranscribe }: { buffer: AudioBuffer; onTranscribe: (a: number, b: number) => void } = $props();

  let canvas: HTMLCanvasElement;
  let selA = $state(0), selB = $state(1); // fractions of the clip
  let dragging = false, x0 = 0;

  function draw() {
    if (!canvas) return;
    const w = (canvas.width = canvas.clientWidth || 600), h = canvas.height, ctx = canvas.getContext('2d');
    if (!ctx) return;
    const d = buffer.getChannelData(0), step = Math.max(1, Math.floor(d.length / w)), mid = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 140, 66, 0.3)'; // selection shade
    ctx.fillRect(selA * w, 0, (selB - selA) * w, h);
    ctx.strokeStyle = getComputedStyle(canvas).color;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      let min = 1, max = -1;
      for (let i = 0; i < step; i++) {
        const v = d[x * step + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ctx.moveTo(x + 0.5, mid + min * mid);
      ctx.lineTo(x + 0.5, mid + max * mid);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  $effect(() => {
    void buffer; // redraw for a new take: reset the selection
    selA = 0;
    selB = 1;
  });
  $effect(() => {
    void [buffer, selA, selB];
    draw();
  });

  const frac = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  function down(e: PointerEvent) {
    dragging = true;
    x0 = selA = selB = frac(e);
    canvas.setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const x = frac(e);
    selA = Math.min(x0, x);
    selB = Math.max(x0, x);
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (selB - selA < 0.004) { selA = 0; selB = 1; } // a click, not a drag: whole clip
  }
  const label = $derived(
    selA > 0 || selB < 1 ? `${(selA * buffer.duration).toFixed(2)}–${(selB * buffer.duration).toFixed(2)}s` : `full clip (${buffer.duration.toFixed(2)}s)`
  );
</script>

<svelte:window onresize={draw} />

<div class="row">
  <span class="hint">Drag across the waveform to pick a region, then re-transcribe just that part.</span>
  <canvas
    bind:this={canvas}
    height="80"
    aria-label="Recording waveform: drag to select a region to re-transcribe"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
  ></canvas>
  <div class="chips">
    <button type="button" class="chip" onclick={() => onTranscribe(selA, selB)}>Transcribe selection</button>
    <button type="button" class="chip" onclick={() => { selA = 0; selB = 1; onTranscribe(0, 1); }}>Full clip</button>
    <span class="hint">{label}</span>
  </div>
</div>

<style>
  canvas { width: 100%; height: 80px; border: 1px solid #888; border-radius: 8px; touch-action: none; cursor: crosshair; display: block; }
</style>
