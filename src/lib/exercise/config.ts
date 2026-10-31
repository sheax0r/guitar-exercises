import type { ExerciseConfig, ExerciseReport } from './types';
import type {
  PlayShapeConfig,
  IdentifyModeConfig,
  ModesReport
} from './modes/types';
import type { CagedConfig, CagedReport } from './caged/types';
import type { DegreesConfig, DegreesReport } from './degrees/types';
import type { ChordTonesConfig, ChordTonesReport } from './chordtones/types';
import type { CallResponseConfig, CallResponseReport } from './callresponse/types';
import type { RhythmConfig, RhythmReport } from './rhythm/types';
import type { LickDrillConfig, LickDrillReport } from './lick/types';

export type AnyConfig = ExerciseConfig | PlayShapeConfig | IdentifyModeConfig | CagedConfig | DegreesConfig | ChordTonesConfig | CallResponseConfig | LickDrillConfig | RhythmConfig;
export type AnyReport = ExerciseReport | ModesReport | CagedReport | DegreesReport | ChordTonesReport | CallResponseReport | LickDrillReport | RhythmReport;
export type AnyExerciseKind = AnyConfig['exercise'];
