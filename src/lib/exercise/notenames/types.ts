import type { Note } from '../../music/notes';
import type { StringNum } from '../../music/tuning';
import type { Pos } from '../../music/caged';

// 'name': a fret is highlighted, type its note name.
// 'play': a note and a string are shown, play (or click) it on that string.
export type NoteNamesVariant = 'name' | 'play';

export interface NoteNamesConfig {
  exercise: 'note-names';
  noteVariant: NoteNamesVariant;
  strings: StringNum[];           // drawn from per prompt; at least one
  inputMode: 'click' | 'mic';     // 'play' only
  micSensitivity: number;
  micDeviceId: string | null;
  maxFret: number;
  durationSec: number;
  continuous: boolean;
  showFretNumbers: boolean;
  playSound: boolean;
}

export interface NoteNamesPrompt {
  variant: NoteNamesVariant;
  string: StringNum;
  note: Note;
  highlight: Pos;                 // 'name': the shown fret; 'play': one answer
  accepted: Pos[];                // every fret on the string that plays `note`
}

export type NoteNamesAnswer = Pos | { note: Note } | { midi: number };
