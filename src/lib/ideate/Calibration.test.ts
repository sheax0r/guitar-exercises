import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

const { openMic } = vi.hoisted(() => ({ openMic: vi.fn(async () => ({ getTracks: () => [] }) as unknown as MediaStream) }));
vi.mock('../audio/pitch', () => ({ openMic }));
vi.mock('../audio/calibration', () => ({ calibrate: vi.fn(async () => -40), saveCalibMs: vi.fn() }));
vi.mock('./state.svelte', () => ({
  settings: { deviceId: null, bpm: 120, num: 4, den: 4, metroVol: 0.5 },
  ui: { recording: false, calibMs: 0, flash: null },
  audioCtx: () => ({ resume: async () => {} }),
  flashBeat: () => {}
}));

import Calibration from './Calibration.svelte';

describe('Calibration', () => {
  it('opens the mic without echo cancellation, which would remove the clicks', async () => {
    const { getByText, findByText } = render(Calibration);
    await fireEvent.click(getByText('Calibrate'));
    await findByText(/calibrated: offset -40 ms/);
    expect(openMic).toHaveBeenCalledWith(null, { echoCancellation: false, noiseSuppression: false, autoGainControl: false });
  });
});
