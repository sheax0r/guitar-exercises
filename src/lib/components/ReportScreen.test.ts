import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ReportScreen from './ReportScreen.svelte';
import type { ExerciseConfig, ExerciseReport } from '../exercise/types';
import type { CagedConfig, CagedReport } from '../exercise/caged/types';

function makeConfig(overrides: Partial<ExerciseConfig> = {}): ExerciseConfig {
  return {
    exercise: 'root-notes',
    targetNote: 'A',
    durationSec: 300,
    continuous: false,
    maxFret: 22,
    showAllLabels: false,
    showRootMarkers: false,
    showFretNumbers: true,
    playSound: false,
    algorithm: 'fret-first',
    intervalKind: 'random',
    keyRoot: 'C',
    keyQuality: 'major',
    direction: 'nearest',
    ...overrides
  };
}

const EMPTY_REPORT: ExerciseReport = {
  totalPrompts: 0,
  correctCount: 0,
  incorrectCount: 0,
  accuracy: 0,
  avgTimeMs: 0,
  perTargetStats: [],
  attempts: []
};

function renderReport(config: ExerciseConfig) {
  return render(ReportScreen, {
    props: { report: EMPTY_REPORT, config, onPracticeAgain: () => {}, onBack: () => {} }
  });
}

describe('ReportScreen — title', () => {
  it('names the fixed target note for root-notes', () => {
    const { container } = renderReport(makeConfig({ targetNote: 'D' }));
    expect(container.querySelector('h2')!.textContent).toContain('target note: D');
  });

  it('names the random pool for random-roots', () => {
    const { container } = renderReport(makeConfig({ exercise: 'random-roots' }));
    const h2 = container.querySelector('h2')!.textContent!;
    expect(h2).toContain('Random roots');
    expect(h2).toContain('A, E, D');
  });
});

describe('ReportScreen — CAGED', () => {
  it('shows per-shape stats', () => {
    const config: CagedConfig = {
      exercise: 'caged', cagedVariant: 'find-tones', enabledShapes: ['C', 'E'], qualities: ['major'],
      include7th: false, fixedRootNote: null, maxFret: 12, durationSec: 300, continuous: false,
      showFretNumbers: true, playSound: false, inputMode: 'click', micSensitivity: 0.5, micDeviceId: null
    };
    const report: CagedReport = {
      totalPrompts: 3, correctCount: 2, incorrectCount: 1, accuracy: 2 / 3, avgTimeMs: 2000,
      perShapeStats: [
        { shape: 'E', timesAsked: 2, correctCount: 1, avgTimeMs: 2500 },
        { shape: 'C', timesAsked: 1, correctCount: 1, avgTimeMs: 1000 }
      ],
      attempts: [{ elapsedMs: 1000, correct: true }, { elapsedMs: 2000, correct: true }, { elapsedMs: 3000, correct: false }]
    };
    const { container } = render(ReportScreen, { props: { report, config, onPracticeAgain: () => {}, onBack: () => {} } });
    expect(container.querySelector('h2')!.textContent).toContain('CAGED Shapes');
    const rows = Array.from(container.querySelectorAll('.per-mode tbody tr')).map(r => r.textContent);
    expect(rows[0]).toContain('C shape');
    expect(rows[1]).toContain('E shape');
    expect(rows[1]).toContain('50%');
    expect(container.textContent).toContain('Weakest shapes');
  });
});
