import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ReportScreen from './ReportScreen.svelte';
import type { RootNotesConfig, RootNotesReport } from '../exercise/rootNotes/types';

function makeConfig(overrides: Partial<RootNotesConfig> = {}): RootNotesConfig {
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
    ...overrides
  };
}

const EMPTY_REPORT: RootNotesReport = {
  totalPrompts: 0,
  correctCount: 0,
  incorrectCount: 0,
  accuracy: 0,
  avgTimeMs: 0,
  perTargetStats: [],
  attempts: []
};

function renderReport(config: RootNotesConfig) {
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
