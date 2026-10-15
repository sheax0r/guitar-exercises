import type { RootNotesConfig, RootNotesReport } from './rootNotes/types';
import type {
  PlayShapeConfig,
  IdentifyModeConfig,
  ModesReport
} from './modes/types';

export type AnyConfig = RootNotesConfig | PlayShapeConfig | IdentifyModeConfig;
export type AnyReport = RootNotesReport | ModesReport;
export type AnyExerciseKind = AnyConfig['exercise'];
