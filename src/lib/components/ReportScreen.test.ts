import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ReportScreen from './ReportScreen.svelte';
import type { Note } from '../music/notes';
import type { RootNotesConfig, RootNotesReport, AttemptRecord, PerTargetStat } from '../exercise/rootNotes/types';

// Canonical answer positions whose played note is the map key.
const NOTE_POSITION: Record<string, { string: 1|2|3|4|5|6; fret: number }> = {
  A: { string: 5, fret: 0 },
  E: { string: 6, fret: 0 },
  D: { string: 4, fret: 0 }
};

// Build a report from a flat list of (note, correct) attempts. perTargetStats
// are aggregated per note at that note's canonical position so the heatmap has
// one marker per distinct note.
function buildReport(attempts: Array<{ note: Note; correct: boolean }>): RootNotesReport {
  const attemptRecords: AttemptRecord[] = attempts.map((a, i) => ({
    elapsedMs: (i + 1) * 1000,
    correct: a.correct,
    targetNote: a.note
  }));
  const byNote = new Map<string, { asked: number; correct: number }>();
  for (const a of attempts) {
    const e = byNote.get(a.note) ?? { asked: 0, correct: 0 };
    e.asked += 1;
    if (a.correct) e.correct += 1;
    byNote.set(a.note, e);
  }
  const perTargetStats: PerTargetStat[] = [...byNote.entries()].map(([note, e]) => ({
    position: NOTE_POSITION[note],
    timesAsked: e.asked,
    correctCount: e.correct,
    avgTimeMs: 1500
  }));
  const total = attempts.length;
  const correct = attempts.filter(a => a.correct).length;
  return {
    totalPrompts: total,
    correctCount: correct,
    incorrectCount: total - correct,
    accuracy: total === 0 ? 0 : correct / total,
    avgTimeMs: 1500,
    perTargetStats,
    attempts: attemptRecords
  };
}

function cardValue(container: HTMLElement, caption: string): string {
  const card = Array.from(container.querySelectorAll('.card'))
    .find(c => c.querySelector('.caption')?.textContent === caption)!;
  return card.querySelector('.big')!.textContent!.trim();
}

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

function renderWith(report: RootNotesReport, config = makeConfig({ exercise: 'random-roots' })) {
  return render(ReportScreen, {
    props: { report, config, onPracticeAgain: () => {}, onBack: () => {} }
  });
}

function noteToggle(container: HTMLElement, note: string): HTMLButtonElement {
  return container.querySelector(`button.note-toggle[data-note="${note}"]`) as HTMLButtonElement;
}

describe('ReportScreen — note filters', () => {
  it('shows no note toggles when only one note was targeted', () => {
    const { container } = renderWith(buildReport([
      { note: 'A', correct: true }, { note: 'A', correct: false }
    ]));
    expect(container.querySelectorAll('button.note-toggle')).toHaveLength(0);
  });

  it('shows a toggle per distinct targeted note when more than one appeared', () => {
    const { container } = renderWith(buildReport([
      { note: 'A', correct: true }, { note: 'E', correct: false }, { note: 'D', correct: true }
    ]));
    expect(container.querySelectorAll('button.note-toggle')).toHaveLength(3);
    expect(noteToggle(container, 'A')).not.toBeNull();
    expect(noteToggle(container, 'E')).not.toBeNull();
    expect(noteToggle(container, 'D')).not.toBeNull();
  });

  it('recomputes the summary cards when notes are toggled off', async () => {
    // Whole session: 5 attempts, 3 correct => 60%. A-only: 2/2 => 100%.
    const { container } = renderWith(buildReport([
      { note: 'A', correct: true }, { note: 'A', correct: true },
      { note: 'E', correct: false }, { note: 'E', correct: false },
      { note: 'D', correct: true }
    ]));
    expect(cardValue(container, 'Accuracy')).toBe('60%');
    expect(cardValue(container, 'Correct / Total')).toBe('3 / 5');

    await fireEvent.click(noteToggle(container, 'E'));
    await fireEvent.click(noteToggle(container, 'D'));

    expect(cardValue(container, 'Accuracy')).toBe('100%');
    expect(cardValue(container, 'Correct / Total')).toBe('2 / 2');
  });

  it('filters heatmap markers to the selected notes', async () => {
    const { container } = renderWith(buildReport([
      { note: 'A', correct: true }, { note: 'E', correct: false }, { note: 'D', correct: true }
    ]));
    expect(container.querySelectorAll('[data-kind="heatmap"]')).toHaveLength(3);

    await fireEvent.click(noteToggle(container, 'E'));
    const notes = Array.from(container.querySelectorAll('[data-kind="heatmap"] text'))
      .map(t => t.textContent);
    expect(notes.sort()).toEqual(['A', 'D']);
  });

  it('keeps at least one note selected (deselecting the last is a no-op)', async () => {
    const { container } = renderWith(buildReport([
      { note: 'A', correct: true }, { note: 'E', correct: false }
    ]));
    await fireEvent.click(noteToggle(container, 'E'));
    // Only A left active; clicking it must not drop to zero selected.
    await fireEvent.click(noteToggle(container, 'A'));
    expect(noteToggle(container, 'A').classList.contains('chip-active')).toBe(true);
    expect(container.querySelectorAll('[data-kind="heatmap"]')).toHaveLength(1);
  });
});

describe('ReportScreen — JSON export', () => {
  it('includes the target note on each attempt and per-position stat', async () => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t: string) => { copied = t; return Promise.resolve(); } }
    });

    const { container } = renderWith(buildReport([
      { note: 'A', correct: true }, { note: 'E', correct: false }, { note: 'D', correct: true }
    ]));
    const copyDataBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Copy data'))!;
    await fireEvent.click(copyDataBtn);

    const data = JSON.parse(copied);
    expect(data.attempts.map((a: { targetNote: string }) => a.targetNote)).toEqual(['A', 'E', 'D']);
    expect(data.perTargetStats.every((s: { note?: string }) => typeof s.note === 'string')).toBe(true);
  });
});
