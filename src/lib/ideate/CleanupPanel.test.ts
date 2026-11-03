import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

const { apis } = vi.hoisted(() => ({ apis: [] as Array<{ metronomeVolume: number }> }));
vi.mock('../transcribe/score', async orig => ({
  ...(await orig<typeof import('../transcribe/score')>()),
  loadAlphaTab: async () => ({
    AlphaTabApi: class {
      metronomeVolume = 0; // alphaTab's default: silent
      playerReady = { on: () => {} };
      playerStateChanged = { on: () => {} };
      constructor() { apis.push(this); }
      destroy() {}
    }
  })
}));
vi.mock('./state.svelte', async orig => ({
  ...(await orig<typeof import('./state.svelte')>()),
  decode: () => new Promise(() => {}) // no waveform needed
}));

import CleanupPanel from './CleanupPanel.svelte';
import { settings, type Job } from './state.svelte';

describe('CleanupPanel', () => {
  it('applies "Metronome during playback" once alphaTab loads, and follows the checkbox', async () => {
    const job = { id: 'j', name: 'take', status: 'done', audio: new Blob() } as unknown as Job;
    const { getByLabelText } = render(CleanupPanel, { job });
    await waitFor(() => expect(apis[0]?.metronomeVolume).toBe(settings.metroVol));
    await userEvent.click(getByLabelText('Metronome during playback'));
    expect(apis[0].metronomeVolume).toBe(0);
  });
});
