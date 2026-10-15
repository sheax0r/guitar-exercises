import type { Mode } from '../../music/modes';
import type { ModesReport, PerModeStat } from './types';

export interface ModeAttempt {
  mode: Mode;
  correct: boolean;
  elapsedMs: number;
}

// Shared per-mode aggregation used by both modes exercises.
export function aggregateModesReport(attempts: ModeAttempt[]): ModesReport {
  const total = attempts.length;
  const correct = attempts.filter(a => a.correct).length;
  const accuracy = total === 0 ? 0 : correct / total;
  const avgTimeMs = total === 0
    ? 0
    : attempts.reduce((sum, a) => sum + a.elapsedMs, 0) / total;

  const byMode = new Map<Mode, { stat: PerModeStat; totalTime: number }>();
  for (const a of attempts) {
    const entry = byMode.get(a.mode) ?? {
      stat: { mode: a.mode, timesAsked: 0, correctCount: 0, avgTimeMs: 0 },
      totalTime: 0
    };
    entry.stat.timesAsked += 1;
    if (a.correct) entry.stat.correctCount += 1;
    entry.totalTime += a.elapsedMs;
    byMode.set(a.mode, entry);
  }
  const perModeStats: PerModeStat[] = [];
  for (const { stat, totalTime } of byMode.values()) {
    perModeStats.push({ ...stat, avgTimeMs: totalTime / stat.timesAsked });
  }

  return {
    totalPrompts: total,
    correctCount: correct,
    incorrectCount: total - correct,
    accuracy,
    avgTimeMs,
    perModeStats,
    attempts: attempts.map(a => ({ elapsedMs: a.elapsedMs, correct: a.correct }))
  };
}
