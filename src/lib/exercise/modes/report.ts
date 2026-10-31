import type { ScaleType } from '../../music/modes';
import type { AttemptRecord } from '../types';
import type { ModesReport } from './types';

export interface ModeAttempt {
  mode: ScaleType;
  correct: boolean;
  elapsedMs: number;
}

export interface GroupStat<K> {
  key: K;
  timesAsked: number;
  correctCount: number;
  avgTimeMs: number;
}

// Session totals plus per-key stats (key = mode, CAGED shape, ...), in first-
// asked order. Shared by the modes and CAGED exercises.
export function aggregateGrouped<K>(attempts: Array<{ key: K; correct: boolean; elapsedMs: number }>) {
  const total = attempts.length;
  const correct = attempts.filter(a => a.correct).length;
  const byKey = new Map<K, { stat: GroupStat<K>; totalTime: number }>();
  for (const a of attempts) {
    const entry = byKey.get(a.key) ?? {
      stat: { key: a.key, timesAsked: 0, correctCount: 0, avgTimeMs: 0 },
      totalTime: 0
    };
    entry.stat.timesAsked += 1;
    if (a.correct) entry.stat.correctCount += 1;
    entry.totalTime += a.elapsedMs;
    byKey.set(a.key, entry);
  }
  return {
    totalPrompts: total,
    correctCount: correct,
    incorrectCount: total - correct,
    accuracy: total === 0 ? 0 : correct / total,
    avgTimeMs: total === 0 ? 0 : attempts.reduce((sum, a) => sum + a.elapsedMs, 0) / total,
    groups: [...byKey.values()].map(({ stat, totalTime }) => ({ ...stat, avgTimeMs: totalTime / stat.timesAsked })),
    attempts: attempts.map((a): AttemptRecord => ({ elapsedMs: a.elapsedMs, correct: a.correct }))
  };
}

export function aggregateModesReport(attempts: ModeAttempt[]): ModesReport {
  const { groups, ...rest } = aggregateGrouped(attempts.map(a => ({ ...a, key: a.mode })));
  return {
    ...rest,
    perModeStats: groups.map(({ key, ...s }) => ({ mode: key, ...s }))
  };
}
