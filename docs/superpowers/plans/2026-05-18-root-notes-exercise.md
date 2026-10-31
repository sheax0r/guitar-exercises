# Root Notes Exercise — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app that helps the user practice finding root notes on a guitar fretboard, with a timed session and a stats report (heatmap + weakest positions).

**Architecture:** Svelte 5 + Vite + TypeScript SPA, three screens (Start → Session → Report) wrapped by a thin router. A reusable SVG `Fretboard` widget knows nothing about the exercise. Exercise logic lives behind a small `Exercise<Config, Prompt, Answer, Report>` interface so a second exercise can be added later without touching the session shell. Audio uses Karplus-Strong synthesis directly on Web Audio (no library deps).

**Tech Stack:** Svelte 5 (runes mode), Vite, TypeScript (strict), Vitest, @testing-library/svelte, jsdom, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-05-18-guitar-exercises-root-notes-design.md`

**Working directory:** `/Users/michael.shea/git/guitar-exercises`

---

## File Layout

```
src/
  App.svelte                     # screen router
  main.ts                        # Svelte 5 mount entrypoint
  app.css                        # global styles
  test-setup.ts                  # vitest + jest-dom matchers bootstrap
  app.d.ts                       # ambient types
  lib/
    music/
      tuning.ts                  # STANDARD_TUNING constant
      notes.ts                   # CHROMATIC, Note, noteAt, allPositionsOf, closestPositionOf
      notes.test.ts
    audio/
      pluck.ts                   # Karplus-Strong; playPluck(string, fret)
      pluck.test.ts              # smoke test only (jsdom has no AudioContext)
    exercise/
      Exercise.ts                # generic Exercise interface
      rootNotes/
        types.ts                 # RootNotesConfig | Prompt | Answer | Report
        RootNotesExercise.ts     # implements Exercise
        RootNotesExercise.test.ts
    components/
      Fretboard.svelte
      Fretboard.test.ts
      StartScreen.svelte
      SessionScreen.svelte
      ReportScreen.svelte
    storage/
      prefs.ts
      prefs.test.ts
index.html
vite.config.ts
svelte.config.js
tsconfig.json
tsconfig.node.json
package.json
.gitignore  (already exists; we'll extend it)
README.md
```

---

## Task 1: Project scaffold (Vite + Svelte 5 + TS + Vitest)

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `svelte.config.js`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/App.svelte`
- Create: `src/app.css`
- Create: `src/app.d.ts`
- Create: `src/test-setup.ts`
- Create: `src/lib/smoke.test.ts` (placeholder to verify Vitest works)
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "guitar-exercises",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/svelte": "^5.2.4",
    "@testing-library/user-event": "^14.5.2",
    "@tsconfig/svelte": "^5.0.4",
    "jsdom": "^25.0.1",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts']
  }
});
```

- [ ] **Step 3: Create `svelte.config.js`**

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess()
};
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "isolatedModules": true,
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src/**/*", "src/**/*.svelte"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Guitar Exercises</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `src/app.d.ts`**

```ts
/// <reference types="svelte" />
/// <reference types="vite/client" />
```

- [ ] **Step 8: Create `src/main.ts`**

```ts
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;
```

- [ ] **Step 9: Create `src/App.svelte`**

```svelte
<script lang="ts">
  const title = 'Guitar Exercises';
</script>

<h1>{title}</h1>
```

- [ ] **Step 10: Create `src/app.css`**

```css
:root {
  font-family: ui-sans-serif, system-ui, sans-serif;
  color-scheme: light dark;
}

body {
  margin: 0;
}
```

- [ ] **Step 11: Create `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 12: Create `src/lib/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('arithmetic still works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 13: Append node_modules + dist to `.gitignore`**

Run:
```bash
printf '\nnode_modules\ndist\n' >> /Users/michael.shea/git/guitar-exercises/.gitignore
```

- [ ] **Step 14: Install dependencies**

Run:
```bash
cd /Users/michael.shea/git/guitar-exercises && npm install
```
Expected: clean install with no errors. May produce deprecation warnings — acceptable.

- [ ] **Step 15: Run tests to verify setup**

Run:
```bash
cd /Users/michael.shea/git/guitar-exercises && npm test
```
Expected: 1 test passes (`smoke > arithmetic still works`). No type errors.

- [ ] **Step 16: Run typecheck**

Run:
```bash
cd /Users/michael.shea/git/guitar-exercises && npm run check
```
Expected: 0 errors, 0 warnings (possibly a "found N files" message).

- [ ] **Step 17: Verify dev server starts**

Run:
```bash
cd /Users/michael.shea/git/guitar-exercises && timeout 5 npm run dev 2>&1 | head -10 || true
```
Expected: output includes `VITE` banner and a local URL like `http://localhost:5173/`.

- [ ] **Step 18: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Scaffold Svelte 5 + Vite + TypeScript + Vitest

Initial project setup with a single smoke test, dev script, build script,
typecheck script, and basic App.svelte placeholder."
```

---

## Task 2: Music theory (`lib/music/`)

**Files:**
- Create: `src/lib/music/tuning.ts`
- Create: `src/lib/music/notes.ts`
- Create: `src/lib/music/notes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/music/notes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CHROMATIC, NOTE_DISPLAY, noteAt, allPositionsOf, closestPositionOf } from './notes';
import { STANDARD_TUNING } from './tuning';

describe('CHROMATIC', () => {
  it('has 12 distinct notes starting at C', () => {
    expect(CHROMATIC.length).toBe(12);
    expect(CHROMATIC[0]).toBe('C');
    expect(new Set(CHROMATIC).size).toBe(12);
  });
});

describe('NOTE_DISPLAY', () => {
  it('has an entry for every chromatic note', () => {
    for (const n of CHROMATIC) {
      expect(NOTE_DISPLAY[n]).toBeTruthy();
    }
  });
  it('shows enharmonic pairs for accidentals', () => {
    expect(NOTE_DISPLAY['A#']).toBe('A♯/B♭');
    expect(NOTE_DISPLAY['F#']).toBe('F♯/G♭');
    expect(NOTE_DISPLAY['A']).toBe('A');
  });
});

describe('STANDARD_TUNING', () => {
  it('has high E on string 1 and low E on string 6', () => {
    expect(STANDARD_TUNING[1]).toBe('E');
    expect(STANDARD_TUNING[2]).toBe('B');
    expect(STANDARD_TUNING[3]).toBe('G');
    expect(STANDARD_TUNING[4]).toBe('D');
    expect(STANDARD_TUNING[5]).toBe('A');
    expect(STANDARD_TUNING[6]).toBe('E');
  });
});

describe('noteAt', () => {
  it('returns the open-string note at fret 0', () => {
    expect(noteAt(5, 0)).toBe('A');
    expect(noteAt(1, 0)).toBe('E');
    expect(noteAt(6, 0)).toBe('E');
  });
  it('wraps through the chromatic scale', () => {
    // String 5 (A), fret 12 should be A again (one octave up)
    expect(noteAt(5, 12)).toBe('A');
    // String 3 (G), fret 2 = A
    expect(noteAt(3, 2)).toBe('A');
    // String 4 (D), fret 7 = A
    expect(noteAt(4, 7)).toBe('A');
    // String 1 (high E), fret 5 = A
    expect(noteAt(1, 5)).toBe('A');
    // String 6 (low E), fret 5 = A
    expect(noteAt(6, 5)).toBe('A');
  });
  it('throws on out-of-range string', () => {
    expect(() => noteAt(0 as never, 0)).toThrow();
    expect(() => noteAt(7 as never, 0)).toThrow();
  });
  it('throws on out-of-range fret', () => {
    expect(() => noteAt(1, -1)).toThrow();
  });
});

describe('allPositionsOf', () => {
  it('finds all A positions on a 22-fret board (standard tuning)', () => {
    const positions = allPositionsOf('A', 22);
    // High E:   5, 17
    // B:        10, 22
    // G:        2, 14
    // D:        7, 19
    // A:        0, 12
    // Low E:    5, 17
    // Total: 11
    expect(positions).toHaveLength(11);
    expect(positions).toContainEqual({ string: 5, fret: 0 });
    expect(positions).toContainEqual({ string: 5, fret: 12 });
    expect(positions).toContainEqual({ string: 3, fret: 2 });
    expect(positions).toContainEqual({ string: 1, fret: 17 });
    expect(positions).toContainEqual({ string: 6, fret: 5 });
  });
  it('returns an empty array if maxFret is too small to contain the note', () => {
    // C only appears at: string 5 fret 3, string 4 fret 10, ... at minimum
    // If maxFret is 0, only open-string notes appear. C is not open.
    const cs = allPositionsOf('C', 0);
    expect(cs).toEqual([]);
  });
});

describe('closestPositionOf', () => {
  it('finds the closest A from string 3 fret 7 (D position) — string 4 fret 7', () => {
    const result = closestPositionOf('A', { string: 3, fret: 7 }, 22);
    expect(result).toEqual({ string: 4, fret: 7 });
  });
  it('returns the position itself when the from-position is the target', () => {
    // String 5 fret 0 = A. Closest A from A is itself.
    const result = closestPositionOf('A', { string: 5, fret: 0 }, 22);
    expect(result).toEqual({ string: 5, fret: 0 });
  });
  it('tie-breaks by lowest string number (highest pitch)', () => {
    // From string 3 fret 8 (D#), the A positions equidistant by fret:
    //   string 5 fret 0 (dist 8), string 4 fret 7 (dist 1), string 1 fret 5 (dist 3),
    //   string 6 fret 5 (dist 3) — string 1 wins tie over string 6.
    const result = closestPositionOf('A', { string: 3, fret: 8 }, 22);
    expect(result).toEqual({ string: 4, fret: 7 });
    // A clearer tie: from string 4 fret 5 (G). A positions:
    //   string 6 fret 5 (dist 0), string 5 fret 0 (dist 5),
    //   string 3 fret 2 (dist 3), string 4 fret 7 (dist 2),
    //   string 1 fret 5 (dist 0), string 2 fret 10 (dist 5)
    // Two zero-distance positions: string 1 fret 5 and string 6 fret 5. String 1 wins.
    const tie = closestPositionOf('A', { string: 4, fret: 5 }, 22);
    expect(tie).toEqual({ string: 1, fret: 5 });
  });
  it('respects maxFret bound', () => {
    // From string 1 fret 22, only positions within 0..22 are considered.
    const result = closestPositionOf('A', { string: 1, fret: 22 }, 22);
    // String 1 fret 17 is closest (dist 5).
    expect(result).toEqual({ string: 1, fret: 17 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: FAIL — modules `./tuning` and `./notes` not found.

- [ ] **Step 3: Create `src/lib/music/tuning.ts`**

```ts
import type { Note } from './notes';

export type StringNum = 1 | 2 | 3 | 4 | 5 | 6;

// String 1 = high E (highest pitch), string 6 = low E.
export const STANDARD_TUNING: Record<StringNum, Note> = {
  1: 'E',
  2: 'B',
  3: 'G',
  4: 'D',
  5: 'A',
  6: 'E'
};
```

- [ ] **Step 4: Create `src/lib/music/notes.ts`**

```ts
import { STANDARD_TUNING, type StringNum } from './tuning';

export const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;
export type Note = typeof CHROMATIC[number];
export type Fret = number;

export const NOTE_DISPLAY: Record<Note, string> = {
  'C': 'C',
  'C#': 'C♯/D♭',
  'D': 'D',
  'D#': 'D♯/E♭',
  'E': 'E',
  'F': 'F',
  'F#': 'F♯/G♭',
  'G': 'G',
  'G#': 'G♯/A♭',
  'A': 'A',
  'A#': 'A♯/B♭',
  'B': 'B'
};

function chromaticIndex(note: Note): number {
  return CHROMATIC.indexOf(note);
}

function assertString(s: number): asserts s is StringNum {
  if (s < 1 || s > 6 || !Number.isInteger(s)) {
    throw new Error(`Invalid string number: ${s}`);
  }
}

function assertFret(f: number): void {
  if (f < 0 || !Number.isInteger(f)) {
    throw new Error(`Invalid fret: ${f}`);
  }
}

export function noteAt(string: StringNum, fret: Fret): Note {
  assertString(string);
  assertFret(fret);
  const open = STANDARD_TUNING[string];
  const idx = (chromaticIndex(open) + fret) % CHROMATIC.length;
  return CHROMATIC[idx];
}

export function allPositionsOf(note: Note, maxFret: Fret): Array<{ string: StringNum; fret: Fret }> {
  assertFret(maxFret);
  const result: Array<{ string: StringNum; fret: Fret }> = [];
  for (let s = 1 as StringNum; s <= 6; s = (s + 1) as StringNum) {
    for (let f = 0; f <= maxFret; f++) {
      if (noteAt(s, f) === note) {
        result.push({ string: s, fret: f });
      }
    }
  }
  return result;
}

export function closestPositionOf(
  target: Note,
  from: { string: StringNum; fret: Fret },
  maxFret: Fret
): { string: StringNum; fret: Fret } {
  assertString(from.string);
  assertFret(from.fret);
  const candidates = allPositionsOf(target, maxFret);
  if (candidates.length === 0) {
    throw new Error(`No positions found for note ${target} within maxFret=${maxFret}`);
  }
  // Closest by absolute fret distance; tie-break by lowest string number.
  let best = candidates[0];
  let bestDist = Math.abs(best.fret - from.fret);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i];
    const dist = Math.abs(c.fret - from.fret);
    if (dist < bestDist || (dist === bestDist && c.string < best.string)) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass, including the smoke test from Task 1.

- [ ] **Step 6: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add music theory primitives (notes, tuning, fretboard math)

Pure functions for fretboard position math: chromatic scale, note-at-position,
all positions of a note across the fretboard, and closest-position-to lookup
with deterministic tie-breaking by string number."
```

---

## Task 3: Exercise interface and Root Notes types

**Files:**
- Create: `src/lib/exercise/Exercise.ts`
- Create: `src/lib/exercise/rootNotes/types.ts`

No tests in this task — these are pure type declarations consumed by Task 4.

- [ ] **Step 1: Create `src/lib/exercise/Exercise.ts`**

```ts
export interface AnswerResult<Answer> {
  correct: boolean;
  correctAnswer: Answer;
  elapsedMs: number;
}

export interface Exercise<Config, Prompt, Answer, Report> {
  start(config: Config): void;
  getNextPrompt(): Prompt;
  submitAnswer(answer: Answer): AnswerResult<Answer>;
  getReport(): Report;
}
```

- [ ] **Step 2: Create `src/lib/exercise/rootNotes/types.ts`**

```ts
import type { Note, Fret } from '../../music/notes';
import type { StringNum } from '../../music/tuning';

export interface RootNotesConfig {
  targetNote: Note;
  durationSec: number;
  maxFret: number;
  showAllLabels: boolean;
  playSound: boolean;
}

export interface RootNotesPrompt {
  highlight: { string: StringNum; fret: Fret };
  highlightNote: Note;
}

export type RootNotesAnswer = { string: StringNum; fret: Fret };

export interface PerTargetStat {
  position: { string: StringNum; fret: Fret };
  timesAsked: number;
  correctCount: number;
  avgTimeMs: number;
}

export interface RootNotesReport {
  totalPrompts: number;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  avgTimeMs: number;
  perTargetStats: PerTargetStat[];
}
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add Exercise interface and Root Notes types

Generic Exercise<Config, Prompt, Answer, Report> interface that any
exercise type implements, plus the concrete shapes used by Root Notes."
```

---

## Task 4: RootNotesExercise — start, getNextPrompt, submitAnswer

**Files:**
- Create: `src/lib/exercise/rootNotes/RootNotesExercise.ts`
- Create: `src/lib/exercise/rootNotes/RootNotesExercise.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/exercise/rootNotes/RootNotesExercise.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RootNotesExercise } from './RootNotesExercise';
import { noteAt, closestPositionOf } from '../../music/notes';
import type { RootNotesConfig } from './types';

const DEFAULT_CONFIG: RootNotesConfig = {
  targetNote: 'A',
  durationSec: 60,
  maxFret: 22,
  showAllLabels: false,
  playSound: false
};

describe('RootNotesExercise.start + getNextPrompt', () => {
  it('produces prompts that are valid fretboard positions', () => {
    const ex = new RootNotesExercise();
    ex.start(DEFAULT_CONFIG);
    for (let i = 0; i < 50; i++) {
      const prompt = ex.getNextPrompt();
      expect(prompt.highlight.string).toBeGreaterThanOrEqual(1);
      expect(prompt.highlight.string).toBeLessThanOrEqual(6);
      expect(prompt.highlight.fret).toBeGreaterThanOrEqual(0);
      expect(prompt.highlight.fret).toBeLessThanOrEqual(22);
      expect(prompt.highlightNote).toBe(noteAt(prompt.highlight.string, prompt.highlight.fret));
    }
  });
  it('does not produce the same prompt twice in a row', () => {
    const ex = new RootNotesExercise();
    ex.start(DEFAULT_CONFIG);
    let prev = ex.getNextPrompt();
    for (let i = 0; i < 200; i++) {
      const next = ex.getNextPrompt();
      expect(
        next.highlight.string === prev.highlight.string &&
        next.highlight.fret === prev.highlight.fret
      ).toBe(false);
      prev = next;
    }
  });
});

describe('RootNotesExercise.submitAnswer', () => {
  it('marks an answer correct when it matches closestPositionOf', () => {
    const ex = new RootNotesExercise();
    ex.start(DEFAULT_CONFIG);
    const prompt = ex.getNextPrompt();
    const correctAnswer = closestPositionOf('A', prompt.highlight, 22);
    const result = ex.submitAnswer(correctAnswer);
    expect(result.correct).toBe(true);
    expect(result.correctAnswer).toEqual(correctAnswer);
    expect(typeof result.elapsedMs).toBe('number');
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
  });
  it('marks an answer incorrect when it does not match', () => {
    const ex = new RootNotesExercise();
    ex.start(DEFAULT_CONFIG);
    const prompt = ex.getNextPrompt();
    const correctAnswer = closestPositionOf('A', prompt.highlight, 22);
    // Pick any A position that isn't the correct one. If only one A exists
    // (impossible on a 22-fret board) skip the assertion.
    const wrong = correctAnswer.string === 1
      ? { string: 5 as const, fret: 12 }
      : { string: 1 as const, fret: 5 };
    const result = ex.submitAnswer(wrong);
    expect(result.correct).toBe(false);
    expect(result.correctAnswer).toEqual(correctAnswer);
  });
  it('measures elapsed time between getNextPrompt and submitAnswer', () => {
    vi.useFakeTimers();
    const ex = new RootNotesExercise();
    ex.start(DEFAULT_CONFIG);
    ex.getNextPrompt();
    vi.advanceTimersByTime(2500);
    const result = ex.submitAnswer({ string: 1, fret: 5 });
    expect(result.elapsedMs).toBeGreaterThanOrEqual(2400);
    expect(result.elapsedMs).toBeLessThanOrEqual(2600);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: FAIL — `RootNotesExercise` not exported.

- [ ] **Step 3: Create `src/lib/exercise/rootNotes/RootNotesExercise.ts`**

```ts
import type { Exercise, AnswerResult } from '../Exercise';
import type {
  RootNotesConfig,
  RootNotesPrompt,
  RootNotesAnswer,
  RootNotesReport,
  PerTargetStat
} from './types';
import { noteAt, closestPositionOf, type Fret } from '../../music/notes';
import type { StringNum } from '../../music/tuning';

interface AttemptLog {
  correctPosition: { string: StringNum; fret: Fret };
  correct: boolean;
  elapsedMs: number;
}

export class RootNotesExercise
  implements Exercise<RootNotesConfig, RootNotesPrompt, RootNotesAnswer, RootNotesReport>
{
  private config!: RootNotesConfig;
  private currentPrompt: RootNotesPrompt | null = null;
  private currentCorrect: { string: StringNum; fret: Fret } | null = null;
  private promptStartedAt = 0;
  private prevPrompt: { string: StringNum; fret: Fret } | null = null;
  private attempts: AttemptLog[] = [];

  start(config: RootNotesConfig): void {
    this.config = config;
    this.currentPrompt = null;
    this.currentCorrect = null;
    this.promptStartedAt = 0;
    this.prevPrompt = null;
    this.attempts = [];
  }

  getNextPrompt(): RootNotesPrompt {
    const maxFret = this.config.maxFret;
    let pick: { string: StringNum; fret: Fret };
    // Random uniform across (6 strings) × (maxFret+1 frets). Reject same as previous.
    do {
      const string = ((Math.floor(Math.random() * 6) + 1) as StringNum);
      const fret = Math.floor(Math.random() * (maxFret + 1));
      pick = { string, fret };
    } while (
      this.prevPrompt &&
      pick.string === this.prevPrompt.string &&
      pick.fret === this.prevPrompt.fret
    );

    this.prevPrompt = pick;
    const prompt: RootNotesPrompt = {
      highlight: pick,
      highlightNote: noteAt(pick.string, pick.fret)
    };
    this.currentPrompt = prompt;
    this.currentCorrect = closestPositionOf(this.config.targetNote, pick, maxFret);
    this.promptStartedAt = Date.now();
    return prompt;
  }

  submitAnswer(answer: RootNotesAnswer): AnswerResult<RootNotesAnswer> {
    if (!this.currentPrompt || !this.currentCorrect) {
      throw new Error('submitAnswer called before getNextPrompt');
    }
    const elapsedMs = Date.now() - this.promptStartedAt;
    const correct =
      answer.string === this.currentCorrect.string &&
      answer.fret === this.currentCorrect.fret;
    this.attempts.push({
      correctPosition: this.currentCorrect,
      correct,
      elapsedMs
    });
    const result: AnswerResult<RootNotesAnswer> = {
      correct,
      correctAnswer: this.currentCorrect,
      elapsedMs
    };
    this.currentPrompt = null;
    this.currentCorrect = null;
    return result;
  }

  getReport(): RootNotesReport {
    const total = this.attempts.length;
    const correct = this.attempts.filter(a => a.correct).length;
    const incorrect = total - correct;
    const accuracy = total === 0 ? 0 : correct / total;
    const avgTimeMs = total === 0
      ? 0
      : this.attempts.reduce((sum, a) => sum + a.elapsedMs, 0) / total;

    // Aggregate per correct-answer position.
    const byKey = new Map<string, { stat: PerTargetStat; totalTime: number }>();
    for (const a of this.attempts) {
      const key = `${a.correctPosition.string}-${a.correctPosition.fret}`;
      const entry = byKey.get(key) ?? {
        stat: {
          position: a.correctPosition,
          timesAsked: 0,
          correctCount: 0,
          avgTimeMs: 0
        },
        totalTime: 0
      };
      entry.stat.timesAsked += 1;
      if (a.correct) entry.stat.correctCount += 1;
      entry.totalTime += a.elapsedMs;
      byKey.set(key, entry);
    }
    const perTargetStats: PerTargetStat[] = [];
    for (const { stat, totalTime } of byKey.values()) {
      perTargetStats.push({
        ...stat,
        avgTimeMs: totalTime / stat.timesAsked
      });
    }

    return {
      totalPrompts: total,
      correctCount: correct,
      incorrectCount: incorrect,
      accuracy,
      avgTimeMs,
      perTargetStats
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Implement RootNotesExercise (start, prompt, answer, report)

Implements the Exercise interface for the Root Notes drill: uniform-random
prompt selection (no consecutive duplicates), elapsed-time tracking per
prompt, per-target-position aggregation in the report."
```

---

## Task 5: getReport aggregation tests

**Files:**
- Modify: `src/lib/exercise/rootNotes/RootNotesExercise.test.ts`

The implementation in Task 4 already includes `getReport`. This task adds focused tests that exercise the aggregation against a scripted sequence — separated from Task 4 to keep test files focused.

- [ ] **Step 1: Append tests to `src/lib/exercise/rootNotes/RootNotesExercise.test.ts`**

Add the following `describe` block to the end of the file:

```ts
describe('RootNotesExercise.getReport', () => {
  it('returns zeroed stats when no prompts have been answered', () => {
    const ex = new RootNotesExercise();
    ex.start(DEFAULT_CONFIG);
    const report = ex.getReport();
    expect(report.totalPrompts).toBe(0);
    expect(report.correctCount).toBe(0);
    expect(report.incorrectCount).toBe(0);
    expect(report.accuracy).toBe(0);
    expect(report.avgTimeMs).toBe(0);
    expect(report.perTargetStats).toEqual([]);
  });

  it('aggregates a scripted sequence correctly', () => {
    // We can't control which prompts are generated, so drive 5 prompts,
    // answer some correctly and some not, then verify the math.
    const ex = new RootNotesExercise();
    ex.start(DEFAULT_CONFIG);
    let correctSubmitted = 0;
    let incorrectSubmitted = 0;
    for (let i = 0; i < 5; i++) {
      const prompt = ex.getNextPrompt();
      const correct = closestPositionOf('A', prompt.highlight, 22);
      if (i % 2 === 0) {
        ex.submitAnswer(correct);
        correctSubmitted++;
      } else {
        // Submit a known-wrong position by flipping the string number.
        const wrong = { string: ((correct.string % 6) + 1) as 1|2|3|4|5|6, fret: correct.fret };
        // Ensure that's actually a different position than `correct`.
        if (wrong.string === correct.string) {
          ex.submitAnswer(correct);
          correctSubmitted++;
        } else {
          ex.submitAnswer(wrong);
          incorrectSubmitted++;
        }
      }
    }
    const report = ex.getReport();
    expect(report.totalPrompts).toBe(5);
    expect(report.correctCount).toBe(correctSubmitted);
    expect(report.incorrectCount).toBe(incorrectSubmitted);
    expect(report.accuracy).toBeCloseTo(correctSubmitted / 5);
    // Sum of times-asked across perTargetStats should equal totalPrompts.
    const sumAsked = report.perTargetStats.reduce((s, p) => s + p.timesAsked, 0);
    expect(sumAsked).toBe(5);
  });

  it('keys perTargetStats by correct-answer position, not prompt position', () => {
    // We need a config where the same correct-answer position recurs.
    // Constraint: pick maxFret=4 so most strings have at most one A position.
    // String 5: fret 0 only. String 3: fret 2 only. Others have no A.
    // So most prompts will resolve to one of {s5f0, s3f2}.
    // Run many prompts and verify all returned positions are valid A positions.
    const ex = new RootNotesExercise();
    ex.start({ ...DEFAULT_CONFIG, maxFret: 4 });
    for (let i = 0; i < 8; i++) {
      const p = ex.getNextPrompt();
      const correct = closestPositionOf('A', p.highlight, 4);
      ex.submitAnswer(correct);
    }
    const report = ex.getReport();
    for (const stat of report.perTargetStats) {
      // Every keyed position must itself be an A.
      expect(noteAt(stat.position.string, stat.position.fret)).toBe('A');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add report-aggregation tests for RootNotesExercise

Tests for the zero-state report, the scripted-sequence aggregate math,
and per-target keying behavior."
```

---

## Task 6: Storage / preferences

**Files:**
- Create: `src/lib/storage/prefs.ts`
- Create: `src/lib/storage/prefs.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/storage/prefs.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadPrefs, savePrefs, type Prefs } from './prefs';

const FULL_PREFS: Prefs = {
  targetNote: 'A',
  durationSec: 180,
  showAllLabels: false,
  playSound: true
};

describe('prefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty object when nothing is stored', () => {
    expect(loadPrefs()).toEqual({});
  });

  it('round-trips a full prefs object', () => {
    savePrefs(FULL_PREFS);
    expect(loadPrefs()).toEqual(FULL_PREFS);
  });

  it('returns empty object on malformed JSON', () => {
    localStorage.setItem('guitar-exercises.prefs.v1', '{not-json');
    expect(loadPrefs()).toEqual({});
  });

  it('does not throw when localStorage is unavailable', () => {
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('blocked'); }
    });
    expect(() => savePrefs(FULL_PREFS)).not.toThrow();
    expect(loadPrefs()).toEqual({});
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: original
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: FAIL — `./prefs` module not found.

- [ ] **Step 3: Create `src/lib/storage/prefs.ts`**

```ts
import type { Note } from '../music/notes';

const KEY = 'guitar-exercises.prefs.v1';

export interface Prefs {
  targetNote: Note;
  durationSec: number;
  showAllLabels: boolean;
  playSound: boolean;
}

export function loadPrefs(): Partial<Prefs> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Partial<Prefs>;
  } catch {
    return {};
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable or quota exceeded. Silently no-op.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add localStorage-backed preferences with safe fallbacks

Round-trips Prefs as JSON in localStorage. Returns empty object on
missing key, malformed JSON, or localStorage access failure."
```

---

## Task 7: Audio — Karplus-Strong pluck

**Files:**
- Create: `src/lib/audio/pluck.ts`
- Create: `src/lib/audio/pluck.test.ts`

`jsdom` has no `AudioContext`. The test only verifies the function exists and does not throw when audio is unavailable.

- [ ] **Step 1: Write the failing test**

Create `src/lib/audio/pluck.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { playPluck } from './pluck';

describe('playPluck', () => {
  it('does not throw when AudioContext is unavailable (jsdom)', () => {
    expect(() => playPluck(1, 5)).not.toThrow();
    expect(() => playPluck(6, 0)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/audio/pluck.ts`**

```ts
import type { StringNum } from '../music/tuning';

// MIDI numbers for the open strings (string 1 = high E = E4 = MIDI 64).
const OPEN_MIDI: Record<StringNum, number> = {
  1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40
};

let ctx: AudioContext | null = null;
let ctxFailed = false;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (ctxFailed) return null;
  if (typeof window === 'undefined') {
    ctxFailed = true;
    return null;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    ctxFailed = true;
    return null;
  }
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    ctxFailed = true;
    return null;
  }
}

function frequencyFor(string: StringNum, fret: number): number {
  const midi = OPEN_MIDI[string] + fret;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playPluck(string: StringNum, fret: number, durationSec = 1.5): void {
  const audioCtx = getCtx();
  if (!audioCtx) return;

  try {
    const freq = frequencyFor(string, fret);
    const sampleRate = audioCtx.sampleRate;
    const delayLen = Math.max(2, Math.round(sampleRate / freq));
    const numSamples = Math.round(sampleRate * durationSec);
    const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    // Initialize the delay line with white noise (pluck excitation).
    const line = new Float32Array(delayLen);
    for (let i = 0; i < delayLen; i++) {
      line[i] = Math.random() * 2 - 1;
    }

    // Karplus-Strong loop: output current sample, replace with average of
    // current + next, scaled by a decay factor.
    const decay = 0.996;
    let idx = 0;
    for (let i = 0; i < numSamples; i++) {
      const current = line[idx];
      const next = line[(idx + 1) % delayLen];
      data[i] = current;
      line[idx] = (current + next) * 0.5 * decay;
      idx = (idx + 1) % delayLen;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;
    source.connect(gain).connect(audioCtx.destination);
    source.start();
  } catch {
    // Anything goes wrong with audio playback — silently skip.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add Karplus-Strong plucked-string audio synthesis

Pure Web Audio implementation: white-noise excitation through a delay
line with a one-zero lowpass feedback. Lazily creates AudioContext on
first call; silently no-ops if audio is unavailable."
```

---

## Task 8: Fretboard component — base SVG rendering

**Files:**
- Create: `src/lib/components/Fretboard.svelte`
- Create: `src/lib/components/Fretboard.test.ts`

This task renders the nut, frets, strings, inlays, string labels, and fret numbers. No labels-per-position and no highlights yet — those come in Tasks 9 and 10. Click handling comes in Task 10.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/Fretboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Fretboard from './Fretboard.svelte';

describe('Fretboard — base rendering', () => {
  it('renders an SVG element', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22 } });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders 6 string lines', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22 } });
    const strings = container.querySelectorAll('[data-role="string"]');
    expect(strings).toHaveLength(6);
  });

  it('renders 22 fret lines (excluding the nut)', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22 } });
    const frets = container.querySelectorAll('[data-role="fret"]');
    expect(frets).toHaveLength(22);
  });

  it('renders string labels e B G D A E top-to-bottom', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22 } });
    const labels = Array.from(container.querySelectorAll('[data-role="string-label"]'));
    expect(labels.map(l => l.textContent)).toEqual(['e', 'B', 'G', 'D', 'A', 'E']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: FAIL — `Fretboard.svelte` not found.

- [ ] **Step 3: Create `src/lib/components/Fretboard.svelte`**

```svelte
<script lang="ts">
  import type { Fret } from '../music/notes';
  import type { StringNum } from '../music/tuning';

  type Props = {
    maxFret: number;
  };

  let { maxFret }: Props = $props();

  // Coordinate system: 1100 x 200 viewBox.
  // Fretboard rect: x 60..1080, y 20..180. Width 1020, height 160.
  // Nut: x 60..70 (10px). Frets evenly spaced from 70 to 1080 over `maxFret` steps.
  const VB_W = 1100;
  const VB_H = 200;
  const BOARD_X = 60;
  const BOARD_Y = 20;
  const BOARD_W = 1020;
  const BOARD_H = 160;
  const NUT_W = 10;

  const fretSpacing = $derived((BOARD_W - NUT_W) / maxFret);
  const fretLines = $derived(
    Array.from({ length: maxFret }, (_, i) => BOARD_X + NUT_W + (i + 1) * fretSpacing)
  );
  // Center of each fret column (where labels and click-areas go).
  // Column 0 = open string area between nut and first fret.
  const fretCenters = $derived(
    Array.from({ length: maxFret + 1 }, (_, i) => BOARD_X + NUT_W + (i + 0.5) * fretSpacing)
  );

  const stringYs = [40, 64, 88, 112, 136, 160]; // string 1..6 top-to-bottom
  const stringWidths = [1, 1.4, 1.8, 2.2, 2.7, 3.2]; // thicker for lower-pitch strings
  const stringLabels = ['e', 'B', 'G', 'D', 'A', 'E'];
  const inlaySingles = [3, 5, 7, 9, 15, 17, 19, 21];
  const INLAY_DOUBLE = 12;
</script>

<svg viewBox="0 0 {VB_W} {VB_H}" class="fretboard" xmlns="http://www.w3.org/2000/svg">
  <!-- Board background -->
  <rect x={BOARD_X} y={BOARD_Y} width={BOARD_W} height={BOARD_H} fill="#5b3a22" />

  <!-- Nut -->
  <rect x={BOARD_X} y={BOARD_Y} width={NUT_W} height={BOARD_H} fill="#e6e1d6" />

  <!-- Fret lines -->
  <g stroke="#bfb8a8" stroke-width="2">
    {#each fretLines as x}
      <line data-role="fret" x1={x} y1={BOARD_Y} x2={x} y2={BOARD_Y + BOARD_H} />
    {/each}
  </g>

  <!-- Inlay dots -->
  <g fill="#d9c896">
    {#each inlaySingles as f}
      {#if f <= maxFret}
        <circle cx={fretCenters[f]} cy={BOARD_Y + BOARD_H / 2} r="5" />
      {/if}
    {/each}
    {#if INLAY_DOUBLE <= maxFret}
      <circle cx={fretCenters[INLAY_DOUBLE]} cy={BOARD_Y + BOARD_H * 0.3} r="5" />
      <circle cx={fretCenters[INLAY_DOUBLE]} cy={BOARD_Y + BOARD_H * 0.7} r="5" />
    {/if}
  </g>

  <!-- Strings -->
  <g stroke="#e8e3d3" stroke-linecap="round">
    {#each stringYs as y, i}
      <line
        data-role="string"
        x1={BOARD_X}
        y1={y}
        x2={BOARD_X + BOARD_W}
        y2={y}
        stroke-width={stringWidths[i]}
      />
    {/each}
  </g>

  <!-- String labels -->
  <g fill="#e8e3d3" font-family="ui-sans-serif, system-ui" font-size="13" font-weight="600" text-anchor="middle">
    {#each stringLabels as label, i}
      <text data-role="string-label" x={36} y={stringYs[i] + 4}>{label}</text>
    {/each}
  </g>

  <!-- Fret numbers -->
  <g fill="#9c9384" font-family="ui-sans-serif, system-ui" font-size="11" text-anchor="middle">
    {#each fretCenters as cx, i}
      <text data-role="fret-number" x={cx} y={BOARD_Y + BOARD_H + 15}>{i}</text>
    {/each}
  </g>
</svg>

<style>
  .fretboard {
    width: 100%;
    display: block;
    min-width: 800px;
  }
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add Fretboard SVG base rendering

Renders nut, frets, strings, standard inlay dots (including double at
fret 12), string letter labels, and fret numbers. No interactivity or
highlights yet."
```

---

## Task 9: Fretboard — labels and highlights props

**Files:**
- Modify: `src/lib/components/Fretboard.svelte`
- Modify: `src/lib/components/Fretboard.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/components/Fretboard.test.ts`:

```ts
describe('Fretboard — labels and highlights', () => {
  it('does not render position labels when labelsVisible=false', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22, labelsVisible: false } });
    const labels = container.querySelectorAll('[data-role="position-label"]');
    expect(labels).toHaveLength(0);
  });

  it('renders a label at every fret×string when labelsVisible=true', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22, labelsVisible: true } });
    const labels = container.querySelectorAll('[data-role="position-label"]');
    // 6 strings × 23 frets (0..22) = 138
    expect(labels).toHaveLength(6 * 23);
  });

  it('highlights the target note in label mode', () => {
    const { container } = render(Fretboard, {
      props: { maxFret: 22, labelsVisible: true, targetHighlightNote: 'A' }
    });
    const accented = container.querySelectorAll('[data-role="position-label"][data-target="true"]');
    expect(accented.length).toBe(11);
  });

  it('renders a prompt highlight at the configured position with the note shown', () => {
    const { container } = render(Fretboard, {
      props: {
        maxFret: 22,
        highlights: [{ string: 3, fret: 7, note: 'D', kind: 'prompt' }]
      }
    });
    const dot = container.querySelector('[data-role="highlight"][data-kind="prompt"]');
    expect(dot).toBeTruthy();
    expect(dot?.textContent?.trim()).toContain('D');
  });

  it('renders multiple highlights of different kinds', () => {
    const { container } = render(Fretboard, {
      props: {
        maxFret: 22,
        highlights: [
          { string: 1, fret: 5, note: 'A', kind: 'prompt' },
          { string: 6, fret: 5, note: 'A', kind: 'correct-flash' }
        ]
      }
    });
    expect(container.querySelector('[data-kind="prompt"]')).toBeTruthy();
    expect(container.querySelector('[data-kind="correct-flash"]')).toBeTruthy();
  });

  it('renders a heatmap highlight with the accuracy-derived color', () => {
    const { container } = render(Fretboard, {
      props: {
        maxFret: 22,
        highlights: [{ string: 4, fret: 7, note: 'A', kind: 'heatmap', accuracy: 0.25 }]
      }
    });
    const dot = container.querySelector('[data-role="highlight"][data-kind="heatmap"]');
    expect(dot).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: FAIL — `labelsVisible`, `highlights`, etc. props not implemented.

- [ ] **Step 3: Update `src/lib/components/Fretboard.svelte`**

Replace the file with this expanded version:

```svelte
<script lang="ts">
  import { noteAt, type Note, type Fret } from '../music/notes';
  import type { StringNum } from '../music/tuning';

  export type HighlightKind = 'prompt' | 'correct-flash' | 'user-correct' | 'user-wrong' | 'heatmap';

  export interface Highlight {
    string: StringNum;
    fret: Fret;
    note: Note;
    kind: HighlightKind;
    accuracy?: number; // 0..1, used only for kind='heatmap'
  }

  type Props = {
    maxFret: number;
    labelsVisible?: boolean;
    targetHighlightNote?: Note;
    highlights?: Highlight[];
  };

  let {
    maxFret,
    labelsVisible = false,
    targetHighlightNote,
    highlights = []
  }: Props = $props();

  const VB_W = 1100;
  const VB_H = 200;
  const BOARD_X = 60;
  const BOARD_Y = 20;
  const BOARD_W = 1020;
  const BOARD_H = 160;
  const NUT_W = 10;

  const fretSpacing = $derived((BOARD_W - NUT_W) / maxFret);
  const fretLines = $derived(
    Array.from({ length: maxFret }, (_, i) => BOARD_X + NUT_W + (i + 1) * fretSpacing)
  );
  const fretCenters = $derived(
    Array.from({ length: maxFret + 1 }, (_, i) => BOARD_X + NUT_W + (i + 0.5) * fretSpacing)
  );

  const stringYs = [40, 64, 88, 112, 136, 160];
  const stringWidths = [1, 1.4, 1.8, 2.2, 2.7, 3.2];
  const stringLabels = ['e', 'B', 'G', 'D', 'A', 'E'];
  const inlaySingles = [3, 5, 7, 9, 15, 17, 19, 21];
  const INLAY_DOUBLE = 12;

  function strYIndex(s: StringNum): number {
    return s - 1; // string 1 -> top
  }

  function heatmapColor(accuracy: number): string {
    // 0 -> red, 0.5 -> yellow, 1 -> green
    const clamped = Math.max(0, Math.min(1, accuracy));
    if (clamped < 0.5) {
      // Red to yellow
      const t = clamped * 2;
      const r = 214, g = Math.round(90 + (197 - 90) * t), b = Math.round(61 + (74 - 61) * t);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow to green
      const t = (clamped - 0.5) * 2;
      const r = Math.round(224 + (95 - 224) * t),
            g = Math.round(197 + (179 - 197) * t),
            b = Math.round(74 + (90 - 74) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  function highlightFill(h: Highlight): string {
    switch (h.kind) {
      case 'prompt':        return '#ff8c42';
      case 'correct-flash': return '#5fb35a';
      case 'user-correct':  return '#a3d977';
      case 'user-wrong':    return '#d65a3d';
      case 'heatmap':       return heatmapColor(h.accuracy ?? 0);
    }
  }
</script>

<svg viewBox="0 0 {VB_W} {VB_H}" class="fretboard" xmlns="http://www.w3.org/2000/svg">
  <rect x={BOARD_X} y={BOARD_Y} width={BOARD_W} height={BOARD_H} fill="#5b3a22" />
  <rect x={BOARD_X} y={BOARD_Y} width={NUT_W} height={BOARD_H} fill="#e6e1d6" />

  <g stroke="#bfb8a8" stroke-width="2">
    {#each fretLines as x}
      <line data-role="fret" x1={x} y1={BOARD_Y} x2={x} y2={BOARD_Y + BOARD_H} />
    {/each}
  </g>

  <g fill="#d9c896">
    {#each inlaySingles as f}
      {#if f <= maxFret}
        <circle cx={fretCenters[f]} cy={BOARD_Y + BOARD_H / 2} r="5" />
      {/if}
    {/each}
    {#if INLAY_DOUBLE <= maxFret}
      <circle cx={fretCenters[INLAY_DOUBLE]} cy={BOARD_Y + BOARD_H * 0.3} r="5" />
      <circle cx={fretCenters[INLAY_DOUBLE]} cy={BOARD_Y + BOARD_H * 0.7} r="5" />
    {/if}
  </g>

  <g stroke="#e8e3d3" stroke-linecap="round">
    {#each stringYs as y, i}
      <line
        data-role="string"
        x1={BOARD_X}
        y1={y}
        x2={BOARD_X + BOARD_W}
        y2={y}
        stroke-width={stringWidths[i]}
      />
    {/each}
  </g>

  <g fill="#e8e3d3" font-family="ui-sans-serif, system-ui" font-size="13" font-weight="600" text-anchor="middle">
    {#each stringLabels as label, i}
      <text data-role="string-label" x={36} y={stringYs[i] + 4}>{label}</text>
    {/each}
  </g>

  <g fill="#9c9384" font-family="ui-sans-serif, system-ui" font-size="11" text-anchor="middle">
    {#each fretCenters as cx, i}
      <text data-role="fret-number" x={cx} y={BOARD_Y + BOARD_H + 15}>{i}</text>
    {/each}
  </g>

  <!-- Position labels (label-mode) -->
  {#if labelsVisible}
    <g font-family="ui-sans-serif, system-ui" font-size="9" text-anchor="middle">
      {#each [1,2,3,4,5,6] as s}
        {#each Array(maxFret + 1) as _, f}
          {@const note = noteAt(s as StringNum, f)}
          {@const isTarget = targetHighlightNote !== undefined && note === targetHighlightNote}
          <text
            data-role="position-label"
            data-target={isTarget ? 'true' : 'false'}
            x={fretCenters[f]}
            y={stringYs[(s as number) - 1] + 4}
            fill={isTarget ? '#ff8c42' : '#cfc6b3'}
            font-weight={isTarget ? '700' : '400'}
          >{note}</text>
        {/each}
      {/each}
    </g>
  {/if}

  <!-- Highlights -->
  <g>
    {#each highlights as h}
      <g data-role="highlight" data-kind={h.kind}>
        <circle
          cx={fretCenters[h.fret]}
          cy={stringYs[strYIndex(h.string)]}
          r="13"
          fill={highlightFill(h)}
          stroke="#fff"
          stroke-width="2"
        />
        <text
          x={fretCenters[h.fret]}
          y={stringYs[strYIndex(h.string)] + 4}
          fill="#1a1a1a"
          font-family="ui-sans-serif, system-ui"
          font-size="11"
          font-weight="700"
          text-anchor="middle"
        >{h.note}</text>
      </g>
    {/each}
  </g>
</svg>

<style>
  .fretboard {
    width: 100%;
    display: block;
    min-width: 800px;
  }
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add labels and highlights support to Fretboard

Adds labelsVisible (full position-label grid), targetHighlightNote
(accent color for matching positions), and a highlights prop supporting
prompt, correct-flash, user-correct, user-wrong, and heatmap kinds."
```

---

## Task 10: Fretboard — click hit-areas + onSelect callback

**Files:**
- Modify: `src/lib/components/Fretboard.svelte`
- Modify: `src/lib/components/Fretboard.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/components/Fretboard.test.ts`:

```ts
import { fireEvent } from '@testing-library/svelte';

describe('Fretboard — click handling', () => {
  it('calls onSelect with the correct (string, fret) when a hit-area is clicked', async () => {
    let received: { string: number; fret: number } | null = null;
    const { container } = render(Fretboard, {
      props: {
        maxFret: 22,
        onSelect: (e: { string: number; fret: number }) => { received = e; }
      }
    });
    const cell = container.querySelector('[data-role="hit"][data-string="3"][data-fret="7"]');
    expect(cell).toBeTruthy();
    await fireEvent.click(cell!);
    expect(received).toEqual({ string: 3, fret: 7 });
  });

  it('renders a hit-area for every (string × fret) intersection', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22, onSelect: () => {} } });
    const cells = container.querySelectorAll('[data-role="hit"]');
    expect(cells).toHaveLength(6 * 23);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: FAIL — `onSelect` not implemented.

- [ ] **Step 3: Update `src/lib/components/Fretboard.svelte`**

Add `onSelect` to the Props type and the destructuring:

Replace the existing `Props` block:

```ts
  type Props = {
    maxFret: number;
    labelsVisible?: boolean;
    targetHighlightNote?: Note;
    highlights?: Highlight[];
  };
```

With:

```ts
  type Props = {
    maxFret: number;
    labelsVisible?: boolean;
    targetHighlightNote?: Note;
    highlights?: Highlight[];
    onSelect?: (pos: { string: StringNum; fret: Fret }) => void;
  };
```

Replace:

```ts
  let {
    maxFret,
    labelsVisible = false,
    targetHighlightNote,
    highlights = []
  }: Props = $props();
```

With:

```ts
  let {
    maxFret,
    labelsVisible = false,
    targetHighlightNote,
    highlights = [],
    onSelect
  }: Props = $props();
```

Then add the hit-areas group inside the `<svg>` immediately *before* the closing `</svg>` tag (above no other elements should render on top of clickable areas — the hit areas must be the last children so they aren't covered):

```svelte
  <!-- Hit areas (must be on top to receive clicks) -->
  <g>
    {#each [1,2,3,4,5,6] as s}
      {#each Array(maxFret + 1) as _, f}
        <rect
          data-role="hit"
          data-string={s}
          data-fret={f}
          x={fretCenters[f] - fretSpacing / 2}
          y={stringYs[(s as number) - 1] - 11}
          width={fretSpacing}
          height={22}
          fill="transparent"
          style="cursor: pointer;"
          onclick={() => onSelect?.({ string: s as StringNum, fret: f as Fret })}
        />
      {/each}
    {/each}
  </g>
```

Wait — the highlights group should remain visible over the board but the hit-areas must capture clicks. Reorder so hit-areas are above highlights but the highlight circles have `pointer-events: none` so the hit-area underneath still receives the click. Add `style="pointer-events: none;"` to the `<g>` wrapping the highlights:

Change:
```svelte
  <!-- Highlights -->
  <g>
```
to:
```svelte
  <!-- Highlights (visual only — hit areas underneath capture clicks) -->
  <g style="pointer-events: none;">
```

And place the new hit-areas `<g>` block AFTER the highlights `<g>` block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add click hit-areas and onSelect callback to Fretboard

Every fret×string intersection is a transparent SVG rect that emits
(string, fret) via the onSelect callback when clicked. Highlight
graphics ignore pointer events so the hit-areas underneath always
receive the click."
```

---

## Task 11: StartScreen component

**Files:**
- Create: `src/lib/components/StartScreen.svelte`

This screen has light test coverage — its logic is mostly form binding. We do one smoke test that the Start button is wired to the callback.

- [ ] **Step 1: Create `src/lib/components/StartScreen.svelte`**

```svelte
<script lang="ts">
  import { CHROMATIC, NOTE_DISPLAY, type Note } from '../music/notes';
  import { loadPrefs, savePrefs, type Prefs } from '../storage/prefs';
  import type { RootNotesConfig } from '../exercise/rootNotes/types';

  type Props = {
    onStart: (config: RootNotesConfig) => void;
  };

  let { onStart }: Props = $props();

  const stored = loadPrefs();
  let targetNote = $state<Note>(stored.targetNote ?? 'A');
  let durationSec = $state<number>(stored.durationSec ?? 300);
  let showAllLabels = $state<boolean>(stored.showAllLabels ?? false);
  let playSound = $state<boolean>(stored.playSound ?? false);
  let customMode = $state<boolean>(![60, 180, 300, 600].includes(durationSec));
  let customValue = $state<number>(customMode ? durationSec : 120);

  const DURATIONS = [
    { label: '1m', sec: 60 },
    { label: '3m', sec: 180 },
    { label: '5m', sec: 300 },
    { label: '10m', sec: 600 }
  ];

  function pickPreset(sec: number) {
    customMode = false;
    durationSec = sec;
  }

  function pickCustom() {
    customMode = true;
    durationSec = customValue > 0 ? customValue : 120;
  }

  function onCustomChange(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!Number.isFinite(v) || v <= 0) {
      customValue = 0;
      return;
    }
    customValue = v;
    if (customMode) durationSec = v;
  }

  const valid = $derived(durationSec > 0);

  function handleStart() {
    if (!valid) return;
    const config: RootNotesConfig = {
      targetNote,
      durationSec,
      maxFret: 22,
      showAllLabels,
      playSound
    };
    const prefs: Prefs = { targetNote, durationSec, showAllLabels, playSound };
    savePrefs(prefs);
    onStart(config);
  }
</script>

<div class="start">
  <h1>Guitar Exercises</h1>

  <div class="row">
    <label for="exercise">Exercise</label>
    <select id="exercise" disabled>
      <option>Root Notes</option>
    </select>
  </div>

  <div class="row">
    <label for="note">Root note</label>
    <select id="note" bind:value={targetNote}>
      {#each CHROMATIC as n}
        <option value={n}>{NOTE_DISPLAY[n]}</option>
      {/each}
    </select>
  </div>

  <div class="row">
    <span class="label">Duration</span>
    <div class="chips">
      {#each DURATIONS as d}
        <button
          type="button"
          class:chip={true}
          class:chip-active={!customMode && durationSec === d.sec}
          onclick={() => pickPreset(d.sec)}
        >{d.label}</button>
      {/each}
      <button
        type="button"
        class:chip={true}
        class:chip-active={customMode}
        onclick={pickCustom}
      >Custom</button>
      {#if customMode}
        <input
          type="number"
          min="1"
          step="1"
          value={customValue}
          oninput={onCustomChange}
          aria-label="Custom duration in seconds"
        />
        <span class="hint">seconds</span>
      {/if}
    </div>
  </div>

  <div class="row">
    <label>
      <input type="checkbox" bind:checked={showAllLabels} />
      Show all labels (warm-up mode)
    </label>
  </div>

  <div class="row">
    <label>
      <input type="checkbox" bind:checked={playSound} />
      Play notes
    </label>
  </div>

  <button class="start-button" disabled={!valid} onclick={handleStart}>Start</button>
</div>

<style>
  .start {
    max-width: 600px;
    margin: 40px auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .row { display: flex; flex-direction: column; gap: 8px; }
  .label { font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .chip {
    padding: 8px 16px;
    border: 1px solid #888;
    background: transparent;
    border-radius: 999px;
    cursor: pointer;
    color: inherit;
  }
  .chip-active {
    background: #ff8c42;
    color: #1a1a1a;
    border-color: #ff8c42;
    font-weight: 700;
  }
  .start-button {
    padding: 14px 24px;
    font-size: 16px;
    font-weight: 700;
    background: #5fb35a;
    color: #0a0a0a;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  .start-button:disabled { opacity: 0.5; cursor: not-allowed; }
  input[type="number"] { width: 80px; padding: 6px; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm run check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add StartScreen with root-note picker, duration chips, and toggles

Loads stored preferences on mount, saves them on Start. Duration is a
chip group (1m/3m/5m/10m/Custom) with an inline numeric input for the
custom case. Validates positive duration before enabling the Start
button."
```

---

## Task 12: SessionScreen component

**Files:**
- Create: `src/lib/components/SessionScreen.svelte`

- [ ] **Step 1: Create `src/lib/components/SessionScreen.svelte`**

```svelte
<script lang="ts">
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import { RootNotesExercise } from '../exercise/rootNotes/RootNotesExercise';
  import type { RootNotesConfig, RootNotesPrompt, RootNotesReport } from '../exercise/rootNotes/types';
  import type { StringNum } from '../music/tuning';
  import { noteAt, type Fret } from '../music/notes';
  import { playPluck } from '../audio/pluck';

  type Props = {
    config: RootNotesConfig;
    onComplete: (report: RootNotesReport) => void;
    onAbort: (report: RootNotesReport) => void;
  };

  let { config, onComplete, onAbort }: Props = $props();

  const exercise = new RootNotesExercise();
  exercise.start(config);

  let currentPrompt = $state<RootNotesPrompt | null>(null);
  let inputLocked = $state(false);
  let flashHighlights = $state<Highlight[]>([]);
  let correctCount = $state(0);
  let incorrectCount = $state(0);
  let remainingSec = $state(config.durationSec);
  let sessionEnded = $state(false);

  const sessionStartedAt = Date.now();

  // Tick the timer once per second.
  const tickHandle = setInterval(() => {
    if (sessionEnded) return;
    const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
    remainingSec = Math.max(0, config.durationSec - elapsed);
  }, 250);

  function endSession(soft: boolean) {
    if (sessionEnded) return;
    sessionEnded = true;
    clearInterval(tickHandle);
    const report = exercise.getReport();
    if (soft) onComplete(report);
    else onAbort(report);
  }

  function nextPrompt() {
    if (sessionEnded) return;
    if (remainingSec <= 0) {
      endSession(true);
      return;
    }
    flashHighlights = [];
    currentPrompt = exercise.getNextPrompt();
    inputLocked = false;
  }

  nextPrompt();

  async function handleSelect(pos: { string: StringNum; fret: Fret }) {
    if (inputLocked || !currentPrompt || sessionEnded) return;
    inputLocked = true;

    if (config.playSound) {
      try { playPluck(pos.string, pos.fret); } catch { /* ignore */ }
    }

    const result = exercise.submitAnswer(pos);

    // Show user's clicked spot.
    flashHighlights = [
      ...buildPromptHighlight(),
      {
        string: pos.string,
        fret: pos.fret,
        note: noteAt(pos.string, pos.fret),
        kind: result.correct ? 'user-correct' : 'user-wrong'
      }
    ];

    if (result.correct) {
      correctCount += 1;
      await new Promise(r => setTimeout(r, 250));
      nextPrompt();
    } else {
      incorrectCount += 1;
      await new Promise(r => setTimeout(r, 250));
      // Reveal correct answer.
      flashHighlights = [
        ...buildPromptHighlight(),
        {
          string: result.correctAnswer.string,
          fret: result.correctAnswer.fret,
          note: noteAt(result.correctAnswer.string, result.correctAnswer.fret),
          kind: 'correct-flash'
        }
      ];
      if (config.playSound) {
        try { playPluck(result.correctAnswer.string, result.correctAnswer.fret); } catch { /* ignore */ }
      }
      await new Promise(r => setTimeout(r, 700));
      nextPrompt();
    }
  }

  function buildPromptHighlight(): Highlight[] {
    if (!currentPrompt) return [];
    return [{
      string: currentPrompt.highlight.string,
      fret: currentPrompt.highlight.fret,
      note: currentPrompt.highlightNote,
      kind: 'prompt'
    }];
  }

  const highlights = $derived<Highlight[]>(
    flashHighlights.length > 0 ? flashHighlights : buildPromptHighlight()
  );

  function confirmAndAbort() {
    if (sessionEnded) return;
    if (window.confirm('End the session now? Stats so far will be shown.')) {
      endSession(false);
    }
  }

  function mmss(s: number): string {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }
</script>

<div class="session">
  <header>
    <div class="target">Target: <strong>{config.targetNote}</strong></div>
    <div class="timer">{mmss(remainingSec)}</div>
    <div class="tally">
      <span class="ok">✓ {correctCount}</span>
      <span class="bad">✗ {incorrectCount}</span>
    </div>
    <button onclick={confirmAndAbort}>End session</button>
  </header>

  <div class="board">
    <Fretboard
      maxFret={config.maxFret}
      labelsVisible={config.showAllLabels}
      targetHighlightNote={config.showAllLabels ? config.targetNote : undefined}
      highlights={highlights}
      onSelect={handleSelect}
    />
  </div>
</div>

<style>
  .session { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  header {
    display: flex; align-items: center; gap: 24px; justify-content: space-between;
    padding: 12px 16px; background: rgba(0,0,0,0.15); border-radius: 8px;
  }
  .target { font-size: 22px; }
  .timer { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .tally { display: flex; gap: 12px; font-size: 16px; }
  .ok { color: #5fb35a; }
  .bad { color: #e07a5f; }
  .board { background: #2a2018; padding: 20px; border-radius: 8px; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm run check`
Expected: 0 errors.

- [ ] **Step 3: Run tests**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: existing tests still pass; no new tests.

- [ ] **Step 4: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add SessionScreen with timer, click flow, and abort handling

Drives the RootNotesExercise: shows the current prompt highlight, locks
input while the answer-result animations play (user-correct/-wrong flash,
then correct-flash on wrong), plays audio on click and on wrong-answer
reveal. Wall-clock timer; soft cutoff at expiration; abort dialog
delivers a partial report."
```

---

## Task 13: ReportScreen component

**Files:**
- Create: `src/lib/components/ReportScreen.svelte`

- [ ] **Step 1: Create `src/lib/components/ReportScreen.svelte`**

```svelte
<script lang="ts">
  import Fretboard, { type Highlight } from './Fretboard.svelte';
  import type { RootNotesReport, PerTargetStat } from '../exercise/rootNotes/types';
  import type { Note } from '../music/notes';
  import { STANDARD_TUNING } from '../music/tuning';

  type Props = {
    report: RootNotesReport;
    targetNote: Note;
    maxFret: number;
    onPracticeAgain: () => void;
    onBack: () => void;
  };

  let { report, targetNote, maxFret, onPracticeAgain, onBack }: Props = $props();

  const accuracyPct = $derived(Math.round(report.accuracy * 100));
  const avgTimeSec = $derived(report.avgTimeMs / 1000);

  const heatmapHighlights = $derived<Highlight[]>(
    report.perTargetStats.map(s => ({
      string: s.position.string,
      fret: s.position.fret,
      note: targetNote,
      kind: 'heatmap' as const,
      accuracy: s.timesAsked === 0 ? 0 : s.correctCount / s.timesAsked
    }))
  );

  function statLabel(s: PerTargetStat): string {
    const stringName = ['', 'e', 'B', 'G', 'D', 'A', 'E'][s.position.string];
    const lowOrHigh = s.position.string === 1 ? ' (high)' : s.position.string === 6 ? ' (low)' : '';
    return `String ${stringName}${lowOrHigh}, fret ${s.position.fret}`;
  }

  const weakest = $derived<PerTargetStat[]>(() => {
    const eligible = report.perTargetStats.filter(s => s.timesAsked >= 2);
    eligible.sort((a, b) => {
      const aAcc = a.correctCount / a.timesAsked;
      const bAcc = b.correctCount / b.timesAsked;
      if (aAcc !== bAcc) return aAcc - bAcc;
      return b.avgTimeMs - a.avgTimeMs;
    });
    return eligible.slice(0, 3);
  });
</script>

<div class="report">
  <h2>Session report — target note: {targetNote}</h2>

  <div class="stats">
    <div class="card"><div class="caption">Accuracy</div><div class="big good">{accuracyPct}%</div></div>
    <div class="card"><div class="caption">Correct / Total</div><div class="big">{report.correctCount} / {report.totalPrompts}</div></div>
    <div class="card"><div class="caption">Errors</div><div class="big bad">{report.incorrectCount}</div></div>
    <div class="card"><div class="caption">Avg time</div><div class="big">{avgTimeSec.toFixed(1)}s</div></div>
  </div>

  <div class="section">
    <div class="caption">Heatmap — {targetNote} positions you saw this session</div>
    <div class="board">
      <Fretboard maxFret={maxFret} highlights={heatmapHighlights} />
    </div>
    <div class="legend">
      <span>Less accurate</span>
      <span class="legend-swatch" style="background:#d65a3d"></span>
      <span class="legend-swatch" style="background:#e07a5f"></span>
      <span class="legend-swatch" style="background:#e0c54a"></span>
      <span class="legend-swatch" style="background:#a3d977"></span>
      <span class="legend-swatch" style="background:#5fb35a"></span>
      <span>More accurate</span>
      <span class="legend-blank">Blank = never asked this session</span>
    </div>
  </div>

  {#if weakest().length > 0}
    <div class="section">
      <div class="caption">Weakest positions</div>
      <ul class="weakest">
        {#each weakest() as s}
          <li>
            <span><strong>{statLabel(s)}</strong></span>
            <span class="muted">{s.correctCount} / {s.timesAsked} correct · avg {(s.avgTimeMs/1000).toFixed(1)}s</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="actions">
    <button class="primary" onclick={onPracticeAgain}>Practice again</button>
    <button onclick={onBack}>Back to start</button>
  </div>
</div>

<style>
  .report { max-width: 1200px; margin: 24px auto; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .card { background: rgba(0,0,0,0.2); padding: 16px; border-radius: 8px; }
  .caption { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
  .big { font-size: 32px; font-weight: 700; margin-top: 4px; }
  .good { color: #5fb35a; }
  .bad { color: #e07a5f; }
  .section { display: flex; flex-direction: column; gap: 8px; }
  .board { background: #2a2018; padding: 20px; border-radius: 8px; }
  .legend { display: flex; align-items: center; gap: 8px; font-size: 12px; opacity: 0.7; flex-wrap: wrap; }
  .legend-swatch { display: inline-block; width: 18px; height: 14px; border-radius: 3px; }
  .legend-blank { margin-left: 16px; }
  .weakest { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .weakest li { display: flex; justify-content: space-between; padding: 10px 14px; background: rgba(0,0,0,0.15); border-radius: 6px; }
  .muted { opacity: 0.6; }
  .actions { display: flex; gap: 12px; }
  .actions button { padding: 12px 20px; border-radius: 6px; border: 1px solid #888; background: transparent; color: inherit; cursor: pointer; }
  .actions .primary { background: #5fb35a; color: #0a0a0a; border-color: #5fb35a; font-weight: 700; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm run check`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add ReportScreen with stats, heatmap fretboard, and weakest list

Shows four headline stats (accuracy %, correct/total, errors, avg time);
a Fretboard rendered in heatmap mode keyed by per-position accuracy;
and a top-3 weakest list filtered to positions with at least 2 attempts."
```

---

## Task 14: App router

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Replace `src/App.svelte`**

```svelte
<script lang="ts">
  import StartScreen from './lib/components/StartScreen.svelte';
  import SessionScreen from './lib/components/SessionScreen.svelte';
  import ReportScreen from './lib/components/ReportScreen.svelte';
  import type { RootNotesConfig, RootNotesReport } from './lib/exercise/rootNotes/types';

  type Screen = 'start' | 'session' | 'report';

  let screen = $state<Screen>('start');
  let activeConfig = $state<RootNotesConfig | null>(null);
  let activeReport = $state<RootNotesReport | null>(null);

  function handleStart(config: RootNotesConfig) {
    activeConfig = config;
    activeReport = null;
    screen = 'session';
  }

  function handleComplete(report: RootNotesReport) {
    activeReport = report;
    screen = 'report';
  }

  function handleAbort(report: RootNotesReport) {
    activeReport = report;
    screen = 'report';
  }

  function handlePracticeAgain() {
    if (!activeConfig) return;
    activeReport = null;
    screen = 'session';
  }

  function handleBack() {
    activeConfig = null;
    activeReport = null;
    screen = 'start';
  }
</script>

{#if screen === 'start'}
  <StartScreen onStart={handleStart} />
{:else if screen === 'session' && activeConfig}
  {#key activeConfig}
    <SessionScreen
      config={activeConfig}
      onComplete={handleComplete}
      onAbort={handleAbort}
    />
  {/key}
{:else if screen === 'report' && activeReport && activeConfig}
  <ReportScreen
    report={activeReport}
    targetNote={activeConfig.targetNote}
    maxFret={activeConfig.maxFret}
    onPracticeAgain={handlePracticeAgain}
    onBack={handleBack}
  />
{/if}
```

The `{#key activeConfig}` block ensures that "Practice again" remounts `SessionScreen` from scratch (timer reset, exercise instance reset) when the user clicks the button without changing config.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm run check`
Expected: 0 errors.

- [ ] **Step 3: Run tests**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm test`
Expected: all tests pass.

- [ ] **Step 4: Build the production bundle**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm run build`
Expected: clean build with no errors. `dist/` directory created.

- [ ] **Step 5: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Wire up App router for start → session → report flow

Top-level state machine: start picks a config, session runs the
exercise, report shows results. Practice-again re-keys the session so
it remounts with fresh state."
```

---

## Task 15: Manual smoke test + README

**Files:**
- Create: `README.md`

This task is the manual verification gate. No automated tests can confirm that the audio sounds right or that the click flow feels good.

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/michael.shea/git/guitar-exercises && npm run dev`

Open the printed URL (typically `http://localhost:5173`) in a browser.

- [ ] **Step 2: Smoke checklist**

Verify each of the following manually. Don't proceed until all are confirmed:

- [ ] Start screen loads with note dropdown, duration chips, two toggles, Start button.
- [ ] Picking "Custom" reveals a number input.
- [ ] Setting custom to `0` disables the Start button; setting to a positive integer enables it.
- [ ] Selecting note "A" and duration "1m" then clicking Start transitions to the session screen.
- [ ] Fretboard renders with a single orange prompt dot showing a note letter.
- [ ] Clicking the closest A position:
  - Green flash on the clicked spot.
  - Auto-advances to a new prompt.
  - Tally `✓ 1 · ✗ 0` updates.
- [ ] Clicking a wrong position:
  - Red flash on the clicked spot.
  - Green flash on the correct A position (~600ms).
  - Auto-advances.
  - Tally updates `✗`.
- [ ] Timer counts down once per second.
- [ ] "End session" button shows a confirm dialog; confirming goes to the report.
- [ ] Letting the timer hit 0 ends the session after the current prompt resolves.
- [ ] Report screen shows: 4 stat cards, heatmap fretboard with dots only at A positions, weakest-positions list (if ≥2 attempts at any single position).
- [ ] "Practice again" returns to a fresh session with the same config.
- [ ] "Back to start" returns to the start screen with previous settings still selected.
- [ ] Re-opening the page (refresh) restores the last-used note/duration/toggles from localStorage.
- [ ] Toggling "Play notes" on Start → during session, clicks play a plucked note sound; wrong answers play the correct note's sound after the user's.
- [ ] Toggling "Show all labels" on Start → during session, every fret/string shows its note letter; A positions are in orange.

- [ ] **Step 3: Create `README.md`**

```markdown
# Guitar Exercises

A local web app for guitar practice. Currently includes one exercise: **Root Notes** — given a target note and a starting position on the fretboard, find the closest occurrence of that note on any string.

## Run it

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

Output goes to `dist/`. Serve those files from any static host.

## Architecture

See [`docs/superpowers/specs/2026-05-18-guitar-exercises-root-notes-design.md`](docs/superpowers/specs/2026-05-18-guitar-exercises-root-notes-design.md) for the full design.

Quick layout:

```
src/
  lib/
    music/        # Note math, tuning, fretboard position helpers
    audio/        # Karplus-Strong pluck synthesis
    exercise/     # Exercise<...> interface and Root Notes implementation
    components/   # Svelte components (screens + Fretboard widget)
    storage/      # localStorage preferences wrapper
  App.svelte      # Screen router
```

## Adding another exercise type

1. Create a new directory under `src/lib/exercise/` (mirror `rootNotes/`).
2. Define your `Config`, `Prompt`, `Answer`, `Report` types.
3. Implement the `Exercise<Config, Prompt, Answer, Report>` interface.
4. Add a screen variant (or, when the second exercise lands, refactor `SessionScreen` to accept an exercise-supplied main view).
5. Add a selector option in `StartScreen`.
```

- [ ] **Step 4: Commit**

```bash
cd /Users/michael.shea/git/guitar-exercises && git add -A && git commit -m "Add README and complete manual smoke pass

README documents how to run, test, and build the app, plus a brief
architecture summary and instructions for adding additional exercises.
All manual smoke-test checks pass."
```

---

## Self-Review Notes

The plan has been reviewed against the spec. Coverage map:

- **Architecture & file layout** (spec §Project layout) → Tasks 1, 3, 4, 6–14
- **Music model** (spec §Music model) → Task 2
- **Exercise interface** (spec §Exercise interface) → Task 3
- **Root Notes specifics** (spec §Root Notes specifics) → Tasks 3, 4, 5
- **Fretboard component** (spec §Fretboard component) → Tasks 8, 9, 10
- **Screen specs — StartScreen** (spec §StartScreen) → Task 11
- **Screen specs — SessionScreen** (spec §SessionScreen) → Task 12
- **Screen specs — ReportScreen** (spec §ReportScreen) → Task 13
- **Audio** (spec §Audio) → Task 7
- **Preferences** (spec §Preferences) → Task 6
- **Edge cases & error handling** (spec §Edge cases) → covered by tests (Tasks 2, 4, 5, 6, 7) and behavior in components (Tasks 11, 12)
- **Testing** (spec §Testing) → distributed across all tasks; Vitest setup in Task 1
- **Stack and tooling** (spec §Stack) → Task 1
- **Manual smoke** → Task 15

No placeholders, TBDs, or "add error handling later" steps. Function and type names are consistent across tasks (`closestPositionOf`, `RootNotesExercise`, `playPluck`, `Highlight`, `Prefs`, `onSelect`, `onStart`, `onComplete`, `onAbort`, `onPracticeAgain`, `onBack`).
