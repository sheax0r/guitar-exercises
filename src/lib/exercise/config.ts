import type { ExerciseConfig, ExerciseReport } from './types';
import type {
  PlayShapeConfig,
  IdentifyModeConfig,
  ModesReport
} from './modes/types';
import type { CagedConfig, CagedReport } from './caged/types';
import type { DegreesConfig, DegreesReport } from './degrees/types';

export type AnyConfig = ExerciseConfig | PlayShapeConfig | IdentifyModeConfig | CagedConfig | DegreesConfig;
export type AnyReport = ExerciseReport | ModesReport | CagedReport | DegreesReport;
export type AnyExerciseKind = AnyConfig['exercise'];
