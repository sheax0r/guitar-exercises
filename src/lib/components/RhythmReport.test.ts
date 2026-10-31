import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RhythmReport from './RhythmReport.svelte';
import { scoreRhythm } from '../exercise/rhythm/rhythm';
import type { RhythmConfig } from '../exercise/rhythm/types';

const config: RhythmConfig = {
  exercise: 'rhythm', target: 'beats', bpm: 120, bars: 1, toleranceMs: 50,
  inputMode: 'mic', micSensitivity: 0.5, micDeviceId: null
};

describe('RhythmReport', () => {
  it('shows error, bias, per-type hit rates and a timeline point per target', () => {
    const report = scoreRhythm([
      { t: 1, kind: 'one', bar: 0 }, { t: 1.5, kind: 'beat', bar: 0 },
      { t: 2, kind: 'beat', bar: 0 }, { t: 2.5, kind: 'beat', bar: 0 }
    ], [1.02, 1.53, 2.01, 2.25], 50, -120);
    const { container } = render(RhythmReport, { props: { report, config, onPracticeAgain: () => {}, onBack: () => {} } });
    const text = container.textContent!;
    expect(text).toContain('3 / 4');           // hits / targets
    expect(text).toContain('20 ms late');      // bias
    expect(text).toContain('Beats 2–4');
    expect(text).toContain('2 / 3');
    expect(text).toContain('offset applied: -120 ms');
    expect(container.querySelectorAll('svg circle')).toHaveLength(3);
    expect(container.querySelector('svg')!.textContent).toContain('✕');
  });
});
