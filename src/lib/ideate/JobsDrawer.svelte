<script lang="ts">
  // The render queue: jobs render one at a time in the background and persist across
  // reloads. Cancel queued/running jobs, delete finished ones, open a ready one.
  import { queue, ui, cancelJob, removeJob, type Job } from './state.svelte';

  let { onOpen }: { onOpen: (job: Job) => void } = $props();

  const LABEL: Record<Job['status'], string> = { queued: 'queued', rendering: 'rendering', done: 'ready', error: 'failed', cancelled: 'cancelled' };
  const active = (j: Job) => j.status === 'queued' || j.status === 'rendering';
  const activeCount = $derived(queue.jobs.filter(active).length);
  const newestFirst = $derived([...queue.jobs].reverse());
</script>

<button type="button" class="chip jobs-toggle" aria-expanded={ui.drawerOpen} onclick={() => (ui.drawerOpen = !ui.drawerOpen)}>
  Jobs{#if activeCount}<span class="count">{activeCount}</span>{/if}
</button>

{#if ui.drawerOpen}
  <aside class="drawer" aria-label="Render queue">
    <div class="head">
      <strong>Render queue</strong>
      <button type="button" class="x" aria-label="Close jobs" onclick={() => (ui.drawerOpen = false)}>✕</button>
    </div>
    <ul>
      {#each newestFirst as j (j.id)}
        <li class="item s-{j.status}" class:cur={ui.currentId === j.id} title={j.status === 'error' ? j.error : undefined}>
          <button type="button" class="open" disabled={j.status !== 'done'} onclick={() => onOpen(j)}>
            <span class="name">{j.name}</span>
            <span class="meta">
              {j.settings.engine}{j.settings.sep ? ' · sep' : ''}{j.status === 'rendering' && j.progress ? ` · ${Math.round(j.progress * 100)}%` : ''}
              · <span class="st">{j.status === 'rendering' && j.phase ? j.phase : LABEL[j.status]}</span>
            </span>
          </button>
          <button type="button" class="small" onclick={() => (active(j) ? cancelJob(j) : removeJob(j))} aria-label={active(j) ? `Cancel ${j.name}` : `Delete ${j.name}`}>
            {active(j) ? 'Cancel' : '✕'}
          </button>
        </li>
      {:else}
        <li class="empty">No jobs yet. Record or upload a file.</li>
      {/each}
    </ul>
  </aside>
{/if}

<style>
  .jobs-toggle { display: inline-flex; align-items: center; gap: 6px; }
  .count { background: #ff8c42; color: #1a1a1a; border-radius: 999px; padding: 0 7px; font-size: 12px; font-weight: 700; }
  .drawer {
    position: fixed; top: 0; right: 0; height: 100dvh; width: 320px; max-width: 88vw; z-index: 40;
    background: Canvas; color: CanvasText; border-left: 1px solid #888;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.18); display: flex; flex-direction: column;
  }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #888; }
  .x { border: none; background: transparent; color: inherit; font-size: 18px; cursor: pointer; }
  ul { list-style: none; margin: 0; padding: 8px; overflow: auto; flex: 1; }
  .item { display: flex; align-items: center; gap: 8px; border: 1px solid #888; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; }
  .item.cur { border-color: #ff8c42; box-shadow: inset 0 0 0 1px #ff8c42; }
  .open { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: left; background: none; border: none; color: inherit; font: inherit; padding: 0; cursor: pointer; }
  .open:disabled { cursor: default; }
  .name { font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
  .meta { font-size: 12px; opacity: 0.75; }
  .s-rendering .st { color: #d97a00; }
  .s-done .st { color: #2e9e3a; }
  .s-error .st { color: #d33; }
  .s-cancelled { opacity: 0.55; }
  .small { border: 1px solid #888; background: transparent; color: inherit; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px; flex: none; }
  .empty { opacity: 0.7; font-size: 14px; text-align: center; padding: 24px 8px; }
</style>
