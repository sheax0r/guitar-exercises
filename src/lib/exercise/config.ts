import type { ExerciseConfig, ExerciseReport } from './types';
import type {
  PlayShapeConfig,
  IdentifyModeConfig,
  ModesReport
} from './modes/types';
import type { CagedConfig, CagedReport } from './caged/types';

export type AnyConfig = ExerciseConfig | PlayShapeConfig | IdentifyModeConfig | CagedConfig;
export type AnyReport = ExerciseReport | ModesReport | CagedReport;
export type AnyExerciseKind = AnyConfig['exercise'];
