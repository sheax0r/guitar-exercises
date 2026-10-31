import { describe, it, expect } from 'vitest';
import { parseHash, sessionHash, canonicalHash, HOME_HASH, LEARN_HASH, IDEATE_HASH } from './hash';
import type { ExerciseConfig } from '../exercise/types';
import type { PlayShapeConfig, IdentifyModeConfig } from '../exercise/modes/types';
import type { CagedConfig } from '../exercise/caged/types';

describe('parseHash', () => {
  it('returns home for empty, root and unknown hashes', () => {
    expect(parseHash('')).toEqual({ screen: 'home' });
    expect(parseHash('#')).toEqual({ screen: 'home' });
    expect(parseHash('#/')).toEqual({ screen: 'home' });
    expect(parseHash('#/anything-else')).toEqual({ screen: 'home' });
  });

  it('parses a valid session hash with all params', () => {
    const r = parseHash('#/session?note=A&duration=300&frets=12&roots=0&labels=0&sound=1&algo=fret-first');
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config).toEqual({
        exercise: 'root-notes',
        targetNote: 'A',
        durationSec: 300,
        continuous: false,
        maxFret: 12,
        showAllLabels: false,
        showRootMarkers: false,
        showFretNumbers: true,
        playSound: true,
        algorithm: 'fret-first',
        intervals: ['3rd', '5th'], intervalRef: 'diatonic-from-note',
        keyRoot: 'C',
        keyQuality: 'major',
        direction: 'nearest',
        rootVariant: 'nearest',
        findAllWindow: 'neck'
      });
    }
  });

  it('treats duration=continuous as continuous mode', () => {
    const r = parseHash('#/session?note=A&duration=continuous&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config).toMatchObject({ continuous: true });
    }
  });

  it('decodes sharp notes', () => {
    const r = parseHash('#/session?note=C%23&duration=300&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session' && r.config.exercise === 'root-notes') {
      expect(r.config.targetNote).toBe('C#');
    }
  });

  it('falls back to start on invalid note', () => {
    expect(parseHash('#/session?note=X&duration=300&frets=12').screen).toBe('learn');
  });

  it('falls back to start when a required param is missing', () => {
    expect(parseHash('#/session?duration=300&frets=12').screen).toBe('learn');
    expect(parseHash('#/session?note=A&frets=12').screen).toBe('learn');
    expect(parseHash('#/session?note=A&duration=300').screen).toBe('learn');
  });

  it('falls back to start on invalid duration / frets', () => {
    expect(parseHash('#/session?note=A&duration=-1&frets=12').screen).toBe('learn');
    expect(parseHash('#/session?note=A&duration=abc&frets=12').screen).toBe('learn');
    expect(parseHash('#/session?note=A&duration=300&frets=0').screen).toBe('learn');
  });

  it('falls back to start on unknown algorithm', () => {
    expect(parseHash('#/session?note=A&duration=300&frets=12&algo=bogus').screen).toBe('learn');
  });

  it('defaults exercise to root-notes when ex param is absent', () => {
    const r = parseHash('#/session?note=A&duration=300&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config.exercise).toBe('root-notes');
    }
  });

  it('parses the ex param for random-roots', () => {
    const r = parseHash('#/session?ex=random-roots&duration=300&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config.exercise).toBe('random-roots');
    }
  });

  it('parses random-roots even when note is absent or invalid', () => {
    const r = parseHash('#/session?ex=random-roots&duration=300&frets=12&note=X');
    expect(r.screen).toBe('session');
  });

  it('falls back to start on an unknown ex value', () => {
    expect(parseHash('#/session?ex=bogus&note=A&duration=300&frets=12').screen).toBe('learn');
  });

  it('defaults optional fields when omitted', () => {
    const r = parseHash('#/session?note=A&duration=300&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session' && r.config.exercise === 'root-notes') {
      expect(r.config.showAllLabels).toBe(false);
      expect(r.config.showRootMarkers).toBe(false);
      expect(r.config.showFretNumbers).toBe(true);
      expect(r.config.playSound).toBe(true);
      expect(r.config.algorithm).toBe('fret-first');
    }
  });
  it('parses the section routes', () => {
    expect(parseHash('#/learn')).toEqual({ screen: 'learn' });
    expect(parseHash('#/ideate')).toEqual({ screen: 'ideate' });
  });

  it('parses sessions under #/learn and the legacy #/session path alike', () => {
    const q = 'note=A&duration=300&frets=12';
    expect(parseHash('#/learn/session?' + q)).toEqual(parseHash('#/session?' + q));
    expect(parseHash('#/learn/session?' + q).screen).toBe('session');
  });
});

describe('canonicalHash', () => {
  it('maps each route to its canonical hash', () => {
    expect(canonicalHash({ screen: 'home' })).toBe(HOME_HASH);
    expect(canonicalHash({ screen: 'learn' })).toBe(LEARN_HASH);
    expect(canonicalHash({ screen: 'ideate' })).toBe(IDEATE_HASH);
  });

  it('rewrites a legacy session hash under #/learn', () => {
    const route = parseHash('#/session?note=A&duration=300&frets=12');
    expect(canonicalHash(route).startsWith('#/learn/session?')).toBe(true);
  });
});

describe('sessionHash round-trip', () => {
  it('round-trips a typical timed config', () => {
    const original: ExerciseConfig = {
      exercise: 'root-notes',
      targetNote: 'C#',
      durationSec: 180,
      continuous: false,
      maxFret: 24,
      showAllLabels: true,
      showRootMarkers: false,
      showFretNumbers: false,
      playSound: false,
      algorithm: 'manhattan',
      intervals: ['3rd', '5th'], intervalRef: 'diatonic-from-note',
      keyRoot: 'C',
      keyQuality: 'major',
      direction: 'nearest',
      rootVariant: 'find-all',
      findAllWindow: 'window'
    };
    const parsed = parseHash(sessionHash(original));
    expect(parsed.screen).toBe('session');
    if (parsed.screen === 'session') {
      expect(parsed.config).toEqual(original);
    }
  });

  it('round-trips an intervals config', () => {
    const original: ExerciseConfig = {
      exercise: 'intervals',
      targetNote: 'A',
      durationSec: 300,
      continuous: false,
      maxFret: 15,
      showAllLabels: false,
      showRootMarkers: false,
      showFretNumbers: true,
      playSound: true,
      algorithm: 'fret-first',
      intervals: ['5th'], intervalRef: 'diatonic-from-note',
      keyRoot: 'G',
      keyQuality: 'minor',
      direction: 'ascending'
    };
    const parsed = parseHash(sessionHash(original));
    expect(parsed.screen).toBe('session');
    if (parsed.screen === 'session') {
      expect(parsed.config).toEqual(original);
    }
  });

  it('round-trips a random-roots config', () => {
    const original: ExerciseConfig = {
      exercise: 'random-roots',
      targetNote: 'A',
      durationSec: 300,
      continuous: false,
      maxFret: 12,
      showAllLabels: false,
      showRootMarkers: false,
      showFretNumbers: true,
      playSound: true,
      algorithm: 'fret-first',
      intervals: ['3rd', '5th'], intervalRef: 'diatonic-from-note',
      keyRoot: 'C',
      keyQuality: 'major',
      direction: 'nearest'
    };
    const parsed = parseHash(sessionHash(original));
    expect(parsed.screen).toBe('session');
    if (parsed.screen === 'session') {
      expect(parsed.config.exercise).toBe('random-roots');
    }
  });

  it('serializes continuous mode using the literal "continuous"', () => {
    const config: ExerciseConfig = {
      exercise: 'root-notes',
      targetNote: 'A',
      durationSec: 300,
      continuous: true,
      maxFret: 12,
      showAllLabels: false,
      showRootMarkers: false,
      showFretNumbers: true,
      playSound: true,
      algorithm: 'fret-first',
      intervals: ['3rd', '5th'], intervalRef: 'diatonic-from-note',
      keyRoot: 'C',
      keyQuality: 'major',
      direction: 'nearest'
    };
    expect(sessionHash(config)).toContain('duration=continuous');
  });
});

describe('parseHash / sessionHash — play-shape', () => {
  it('round-trips a play-shape config', () => {
    const config: PlayShapeConfig = {
      exercise: 'play-shape',
      enabledModes: ['ionian', 'dorian'],
      shapeVariant: 'octave',
      octaveJudge: 'pitch',
      boxSpan: 4,
      maxFret: 12,
      durationSec: 300,
      continuous: false,
      showFretNumbers: true,
      playSound: true,
      drone: true,
      highlightCharacteristic: true,
      fixedRootNote: 'G',
      inputMode: 'mic',
      micSensitivity: 0.3,
      micDeviceId: null,
      displayNotePercentage: 60
    };
    const r = parseHash(sessionHash(config));
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config).toEqual(config);
    }
  });

  it('round-trips a box play-shape config', () => {
    const config: PlayShapeConfig = {
      exercise: 'play-shape',
      enabledModes: ['mixolydian'],
      shapeVariant: 'box',
      octaveJudge: 'pitch',
      boxSpan: 5,
      maxFret: 24,
      durationSec: 180,
      continuous: false,
      showFretNumbers: false,
      playSound: false,
      drone: false,
      highlightCharacteristic: false,
      fixedRootNote: null,
      inputMode: 'mic',
      micSensitivity: 0.8,
      micDeviceId: null,
      displayNotePercentage: 100
    };
    const r = parseHash(sessionHash(config));
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config).toEqual(config);
    }
  });

  it('keeps input=mic for the box variant', () => {
    const r = parseHash('#/session?ex=play-shape&modes=ionian&duration=300&frets=12&variant=box&input=mic');
    expect(r.screen).toBe('session');
    if (r.screen === 'session' && r.config.exercise === 'play-shape') {
      expect(r.config.inputMode).toBe('mic');
    }
  });

  it('coerces input=mic to click for octave + fixed fingering', () => {
    const r = parseHash('#/session?ex=play-shape&modes=ionian&duration=300&frets=12&variant=octave&judge=fixed&input=mic');
    expect(r.screen).toBe('session');
    if (r.screen === 'session' && r.config.exercise === 'play-shape') {
      expect(r.config.inputMode).toBe('click');
    }
  });

  it('blank or missing sens falls back to the default sensitivity, not 0', () => {
    const blank = parseHash('#/session?ex=play-shape&modes=ionian&duration=300&frets=12&variant=octave&judge=pitch&sens=');
    const missing = parseHash('#/session?ex=play-shape&modes=ionian&duration=300&frets=12&variant=octave&judge=pitch');
    for (const r of [blank, missing]) {
      expect(r.screen).toBe('session');
      if (r.screen === 'session' && r.config.exercise === 'play-shape') {
        expect(r.config.micSensitivity).toBeGreaterThan(0);
      }
    }
  });

  it('legacy play-shape URL (no new params) parses to defaults', () => {
    const r = parseHash('#/session?ex=play-shape&modes=ionian&variant=octave&judge=fixed&span=4&duration=300&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session' && r.config.exercise === 'play-shape') {
      expect(r.config.drone).toBe(false);
      expect(r.config.highlightCharacteristic).toBe(false);
      expect(r.config.fixedRootNote).toBe(null);
      expect(r.config.inputMode).toBe('click');
    }
  });

  it('falls back to start when no modes are enabled', () => {
    expect(parseHash('#/session?ex=play-shape&modes=&duration=300&frets=12'))
      .toEqual({ screen: 'learn' });
  });

  it('falls back to start on an unknown mode name', () => {
    expect(parseHash('#/session?ex=play-shape&modes=bogus&duration=300&frets=12'))
      .toEqual({ screen: 'learn' });
  });
});

describe('parseHash / sessionHash — identify-mode', () => {
  it('round-trips an identify-mode config', () => {
    const config: IdentifyModeConfig = {
      exercise: 'identify-mode',
      enabledModes: ['ionian', 'aeolian'],
      maxFret: 12,
      durationSec: 300,
      continuous: false,
      showFretNumbers: true,
      playSound: false,
      drone: true,
      highlightCharacteristic: true,
      fixedRootNote: 'D',
      promptMode: 'audio',
      displayNotePercentage: 40
    };
    const r = parseHash(sessionHash(config));
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config).toEqual(config);
    }
  });

  it('legacy identify-mode URL (no new params) parses to defaults', () => {
    const r = parseHash('#/session?ex=identify-mode&modes=ionian,dorian&duration=300&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session' && r.config.exercise === 'identify-mode') {
      expect(r.config.drone).toBe(false);
      expect(r.config.highlightCharacteristic).toBe(false);
      expect(r.config.fixedRootNote).toBe(null);
      expect(r.config.promptMode).toBe('visual');
    }
  });

  it('falls back to start when no modes are enabled', () => {
    expect(parseHash('#/session?ex=identify-mode&modes=&duration=300&frets=12'))
      .toEqual({ screen: 'learn' });
  });
});

describe('caged hash', () => {
  const caged: CagedConfig = {
    exercise: 'caged',
    cagedVariant: 'next-shape',
    enabledShapes: ['C', 'E', 'D'],
    qualities: ['minor'],
    include7th: true,
    fixedRootNote: 'F#',
    maxFret: 22,
    durationSec: 120,
    continuous: false,
    showFretNumbers: false,
    playSound: true,
    inputMode: 'click',
    micJudge: 'notes',
    micSensitivity: 0.3,
    micDeviceId: null
  };

  it('round-trips every variant', () => {
    for (const cagedVariant of ['find-tones', 'name-shape', 'next-shape'] as const) {
      const c = { ...caged, cagedVariant };
      expect(parseHash(sessionHash(c))).toEqual({ screen: 'session', config: c });
    }
    const mic = { ...caged, cagedVariant: 'find-tones' as const, inputMode: 'mic' as const, fixedRootNote: null, continuous: true, durationSec: 300 };
    expect(parseHash(sessionHash(mic))).toEqual({ screen: 'session', config: mic });
    const strum = { ...mic, micJudge: 'strum-bass' as const };
    expect(parseHash(sessionHash(strum))).toEqual({ screen: 'session', config: strum });
  });

  it('defaults the mic judge to single notes', () => {
    const r = parseHash('#/learn/session?ex=caged&shapes=C&quals=major&duration=300&frets=12&input=mic&mjudge=bogus');
    expect(r.screen === 'session' && r.config.exercise === 'caged' && r.config.micJudge).toBe('notes');
  });

  it('coerces mic to click outside find-tones and rejects bad lists', () => {
    const r = parseHash(sessionHash({ ...caged, inputMode: 'mic' }));
    expect(r.screen === 'session' && r.config.exercise === 'caged' && r.config.inputMode).toBe('click');
    expect(parseHash('#/learn/session?ex=caged&shapes=C,X&quals=major&duration=300&frets=12').screen).toBe('learn');
    expect(parseHash('#/learn/session?ex=caged&shapes=C&quals=&duration=300&frets=12').screen).toBe('learn');
  });

  it('defaults the variant to find-tones', () => {
    const r = parseHash('#/learn/session?ex=caged&shapes=C&quals=major&duration=300&frets=12');
    expect(r.screen === 'session' && r.config.exercise === 'caged' && r.config.cagedVariant).toBe('find-tones');
  });
});

describe('parseHash — scale types and the caged shape variant', () => {
  it('accepts the new scales and keeps mic for the caged variant', () => {
    const r = parseHash('#/learn/session?ex=play-shape&modes=ionian,minor-pentatonic,blues&duration=300&frets=12&variant=caged&input=mic');
    expect(r.screen).toBe('session');
    if (r.screen === 'session' && r.config.exercise === 'play-shape') {
      expect(r.config.enabledModes).toEqual(['ionian', 'minor-pentatonic', 'blues']);
      expect(r.config.shapeVariant).toBe('caged');
      expect(r.config.inputMode).toBe('mic');
      expect(parseHash(sessionHash(r.config))).toEqual(r);
    }
  });
  it('rejects an unknown scale', () => {
    expect(parseHash('#/learn/session?ex=identify-mode&modes=ionian,bebop&duration=300&frets=12').screen).toBe('learn');
  });
});

describe('parseHash — interval upgrades and Name the Degree', () => {
  const base = '#/learn/session?ex=intervals&duration=300&frets=12';
  const ints = (h: string) => {
    const r = parseHash(h);
    return r.screen === 'session' && r.config.exercise === 'intervals' ? r.config : null;
  };
  it('legacy int values map to the interval list', () => {
    expect(ints(base + '&int=random')!.intervals).toEqual(['3rd', '5th']);
    expect(ints(base)!.intervals).toEqual(['3rd', '5th']);
    expect(ints(base + '&int=5th')!.intervals).toEqual(['5th']);
    expect(ints(base)!.intervalRef).toBe('diatonic-from-note');
  });
  it('round-trips new intervals and the from-root reference', () => {
    const c = ints(base + '&int=2nd,7th&iref=root')!;
    expect(c.intervals).toEqual(['2nd', '7th']);
    expect(c.intervalRef).toBe('from-root');
    expect(parseHash(sessionHash(c))).toEqual({ screen: 'session', config: c });
  });
  it('round-trips a degrees config', () => {
    const r = parseHash('#/learn/session?ex=degrees&dvar=find&keyroot=D&duration=continuous&frets=12');
    expect(r).toMatchObject({ screen: 'session', config: { exercise: 'degrees', degreeVariant: 'find', keyRoot: 'D', continuous: true } });
    if (r.screen === 'session') expect(parseHash(sessionHash(r.config))).toEqual(r);
  });
});

describe('parseHash — Root Notes find all', () => {
  it('old root-notes URLs default to the nearest drill', () => {
    const r = parseHash('#/session?note=A&duration=300&frets=12');
    expect(r).toMatchObject({ config: { rootVariant: 'nearest', findAllWindow: 'neck' } });
  });
  it('parses rvar=all and win=window', () => {
    const r = parseHash('#/learn/session?ex=random-roots&duration=300&frets=12&rvar=all&win=window');
    expect(r).toMatchObject({ config: { exercise: 'random-roots', rootVariant: 'find-all', findAllWindow: 'window' } });
  });
});

describe('parseHash — chord-tone targeting', () => {
  it('fills defaults for a bare URL', () => {
    const r = parseHash('#/learn/session?ex=chord-tones&duration=300&frets=12');
    expect(r).toMatchObject({ screen: 'session', config: {
      exercise: 'chord-tones', progression: 'ii-V-I', keyRoot: 'random', target: 'guide',
      backing: 'chord', tempo: 'untimed', bpm: 80, barsPerChord: 1, inputMode: 'click'
    } });
  });
  it('round-trips a timed mic config', () => {
    const r = parseHash('#/learn/session?ex=chord-tones&prog=blues&keyroot=A&tgt=7th&back=drone&tempo=timed&bpm=96&bars=2&input=mic&duration=continuous&frets=12');
    expect(r).toMatchObject({ config: { progression: 'blues', keyRoot: 'A', target: '7th', backing: 'drone', tempo: 'timed', bpm: 96, barsPerChord: 2, inputMode: 'mic' } });
    if (r.screen === 'session') expect(parseHash(sessionHash(r.config))).toEqual(r);
  });
  it('clamps the tempo', () => {
    const r = parseHash('#/learn/session?ex=chord-tones&bpm=900&duration=300&frets=12');
    expect(r).toMatchObject({ config: { bpm: 200 } });
  });
});

describe('parseHash — call and response', () => {
  it('fills defaults for a bare URL', () => {
    const r = parseHash('#/learn/session?ex=call-response&duration=300&frets=12');
    expect(r).toMatchObject({ screen: 'session', config: {
      exercise: 'call-response', lengths: [3], degrees: ['1', '3', '5'], motion: 'leaps',
      showStart: false, rhythm: false, keyRoot: 'random', drone: false, inputMode: 'click'
    } });
  });
  it('round-trips a full config', () => {
    const r = parseHash('#/learn/session?ex=call-response&lens=2,4&degs=1,2,3,5&motion=step&start=1&rhythm=1&keyroot=G&drone=1&input=mic&duration=continuous&frets=12');
    expect(r).toMatchObject({ config: { lengths: [2, 4], degrees: ['1', '2', '3', '5'], motion: 'stepwise', showStart: true, rhythm: true, keyRoot: 'G', drone: true, inputMode: 'mic' } });
    if (r.screen === 'session') expect(parseHash(sessionHash(r.config))).toEqual(r);
  });
  it('needs two degrees', () => {
    expect(parseHash('#/learn/session?ex=call-response&degs=5&duration=300&frets=12')).toMatchObject({ config: { degrees: ['1', '3', '5'] } });
  });
});

describe('parseHash — rhythm', () => {
  it('fills defaults for a bare URL (no duration or frets needed)', () => {
    expect(parseHash('#/learn/session?ex=rhythm')).toEqual({ screen: 'session', config: {
      exercise: 'rhythm', target: 'beats', bpm: 80, bars: 8, toleranceMs: 50, inputMode: 'mic',
      micSensitivity: 0.5, micDeviceId: null
    } });
  });
  it('round-trips a full config, and rejects off-menu bars and tolerance', () => {
    const r = parseHash('#/learn/session?ex=rhythm&tgt=ands&bpm=100&bars=16&tol=30&input=click&sens=0.7');
    expect(r).toMatchObject({ config: { target: 'ands', bpm: 100, bars: 16, toleranceMs: 30, inputMode: 'click', micSensitivity: 0.7 } });
    if (r.screen === 'session') expect(parseHash(sessionHash(r.config))).toEqual(r);
    expect(parseHash('#/learn/session?ex=rhythm&bars=7&tol=999&bpm=5')).toMatchObject({ config: { bars: 8, toleranceMs: 50, bpm: 40 } });
  });
});
