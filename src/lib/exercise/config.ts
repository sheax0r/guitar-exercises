import type { ExerciseConfig, ExerciseReport } from './types';
import type {
  PlayShapeConfig,
  IdentifyModeConfig,
  ModesReport
} from './modes/types';

export type AnyConfig = ExerciseConfig | PlayShapeConfig | IdentifyModeConfig;
export type AnyReport = ExerciseReport | ModesReport;
export type AnyExerciseKind = AnyConfig['exercise'];
