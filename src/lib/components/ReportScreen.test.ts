import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ReportScreen from './ReportScreen.svelte';
import type { ExerciseConfig, ExerciseReport } from '../exercise/types';
import type { CagedConfig, CagedReport } from '../exercise/caged/types';
import type { ChordTonesConfig, ChordTonesReport } from '../exercise/chordtones/types';
import type { CallResponseConfig, CallResponseReport } from '../exercise/callresponse/types';

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
    intervals: ['3rd', '5th'], intervalRef: 'diatonic-from-note',
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
      showFretNumbers: true, playSound: false, inputMode: 'click', micJudge: 'notes', micSensitivity: 0.5, micDeviceId: null
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

describe('ReportScreen — Chord-Tone Targeting', () => {
  it('shows per-chord (progression order) and per-target tables', () => {
    const config: ChordTonesConfig = {
      exercise: 'chord-tones', progression: 'ii-V-I', keyRoot: 'C', target: 'guide', backing: 'chord',
      tempo: 'untimed', bpm: 80, barsPerChord: 1, algorithm: 'fret-first', inputMode: 'click',
      micSensitivity: 0.5, micDeviceId: null, maxFret: 12, durationSec: 300, continuous: false,
      showFretNumbers: true, playSound: false
    };
    const report: ChordTonesReport = {
      totalPrompts: 3, correctCount: 2, incorrectCount: 1, accuracy: 2 / 3, avgTimeMs: 1000,
      perChordStats: [
        { numeral: 'ii', timesAsked: 1, correctCount: 1, avgTimeMs: 1000 },
        { numeral: 'V', timesAsked: 1, correctCount: 0, avgTimeMs: 1000 },
        { numeral: 'I', timesAsked: 1, correctCount: 1, avgTimeMs: 1000 }
      ],
      perToneStats: [
        { tone: '3rd', timesAsked: 2, correctCount: 2, avgTimeMs: 1000 },
        { tone: '7th', timesAsked: 1, correctCount: 0, avgTimeMs: 1000 }
      ],
      attempts: [{ elapsedMs: 1000, correct: true }, { elapsedMs: 1000, correct: false }, { elapsedMs: 1000, correct: true }]
    };
    const { container } = render(ReportScreen, { props: { report, config, onPracticeAgain: () => {}, onBack: () => {} } });
    expect(container.querySelector('h2')!.textContent).toContain('Chord-Tone Targeting');
    const tables = container.querySelectorAll('table.per-mode');
    expect(tables).toHaveLength(2);
    expect(Array.from(tables[0].querySelectorAll('tbody tr')).map(r => r.firstElementChild!.textContent)).toEqual(['ii', 'V', 'I']);
    expect(tables[1].textContent).toContain('7th');
    expect(tables[1].textContent).toContain('0%');
  });
});

describe('ReportScreen — Call and Response', () => {
  it('shows per-length and per-degree tables', () => {
    const config: CallResponseConfig = {
      exercise: 'call-response', lengths: [2, 3], degrees: ['1', '3', '5'], motion: 'leaps', showStart: false,
      rhythm: false, keyRoot: 'C', drone: false, inputMode: 'click', micSensitivity: 0.5, micDeviceId: null,
      maxFret: 12, durationSec: 300, continuous: false, showFretNumbers: true, playSound: false
    };
    const report: CallResponseReport = {
      totalPrompts: 2, correctCount: 1, incorrectCount: 1, accuracy: 0.5, avgTimeMs: 3000,
      perLengthStats: [
        { length: 2, timesAsked: 1, correctCount: 1, avgTimeMs: 2000 },
        { length: 3, timesAsked: 1, correctCount: 0, avgTimeMs: 4000 }
      ],
      perDegreeStats: [
        { degree: '1', timesAsked: 2, correctCount: 2, avgTimeMs: 3000 },
        { degree: '5', timesAsked: 2, correctCount: 1, avgTimeMs: 3000 }
      ],
      attempts: [{ elapsedMs: 2000, correct: true }, { elapsedMs: 4000, correct: false }]
    };
    const { container } = render(ReportScreen, { props: { report, config, onPracticeAgain: () => {}, onBack: () => {} } });
    expect(container.querySelector('h2')!.textContent).toContain('Call and Response');
    const tables = container.querySelectorAll('table.per-mode');
    expect(tables).toHaveLength(2);
    expect(tables[0].textContent).toContain('3 notes');
    expect(tables[1].querySelector('th')!.textContent).toBe('Degree');
    expect(tables[1].textContent).toContain('50%');
  });
});
