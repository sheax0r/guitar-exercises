import { describe, it, expect } from 'vitest';
import { parseHash, sessionHash } from './hash';
import type { RootNotesConfig } from '../exercise/rootNotes/types';

describe('parseHash', () => {
  it('returns start for empty / root hashes', () => {
    expect(parseHash('')).toEqual({ screen: 'start' });
    expect(parseHash('#')).toEqual({ screen: 'start' });
    expect(parseHash('#/')).toEqual({ screen: 'start' });
    expect(parseHash('#/anything-else')).toEqual({ screen: 'start' });
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
        algorithm: 'fret-first'
      });
    }
  });

  it('treats duration=continuous as continuous mode', () => {
    const r = parseHash('#/session?note=A&duration=continuous&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config.continuous).toBe(true);
    }
  });

  it('decodes sharp notes', () => {
    const r = parseHash('#/session?note=C%23&duration=300&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config.targetNote).toBe('C#');
    }
  });

  it('falls back to start on invalid note', () => {
    expect(parseHash('#/session?note=X&duration=300&frets=12').screen).toBe('start');
  });

  it('falls back to start when a required param is missing', () => {
    expect(parseHash('#/session?duration=300&frets=12').screen).toBe('start');
    expect(parseHash('#/session?note=A&frets=12').screen).toBe('start');
    expect(parseHash('#/session?note=A&duration=300').screen).toBe('start');
  });

  it('falls back to start on invalid duration / frets', () => {
    expect(parseHash('#/session?note=A&duration=-1&frets=12').screen).toBe('start');
    expect(parseHash('#/session?note=A&duration=abc&frets=12').screen).toBe('start');
    expect(parseHash('#/session?note=A&duration=300&frets=0').screen).toBe('start');
  });

  it('falls back to start on unknown algorithm', () => {
    expect(parseHash('#/session?note=A&duration=300&frets=12&algo=bogus').screen).toBe('start');
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
    expect(parseHash('#/session?ex=bogus&note=A&duration=300&frets=12').screen).toBe('start');
  });

  it('defaults optional fields when omitted', () => {
    const r = parseHash('#/session?note=A&duration=300&frets=12');
    expect(r.screen).toBe('session');
    if (r.screen === 'session') {
      expect(r.config.showAllLabels).toBe(false);
      expect(r.config.showRootMarkers).toBe(false);
      expect(r.config.showFretNumbers).toBe(true);
      expect(r.config.playSound).toBe(true);
      expect(r.config.algorithm).toBe('fret-first');
    }
  });
});

describe('sessionHash round-trip', () => {
  it('round-trips a typical timed config', () => {
    const original: RootNotesConfig = {
      exercise: 'root-notes',
      targetNote: 'C#',
      durationSec: 180,
      continuous: false,
      maxFret: 24,
      showAllLabels: true,
      showRootMarkers: false,
      showFretNumbers: false,
      playSound: false,
      algorithm: 'manhattan'
    };
    const parsed = parseHash(sessionHash(original));
    expect(parsed.screen).toBe('session');
    if (parsed.screen === 'session') {
      expect(parsed.config).toEqual(original);
    }
  });

  it('round-trips a random-roots config', () => {
    const original: RootNotesConfig = {
      exercise: 'random-roots',
      targetNote: 'A',
      durationSec: 300,
      continuous: false,
      maxFret: 12,
      showAllLabels: false,
      showRootMarkers: false,
      showFretNumbers: true,
      playSound: true,
      algorithm: 'fret-first'
    };
    const parsed = parseHash(sessionHash(original));
    expect(parsed.screen).toBe('session');
    if (parsed.screen === 'session') {
      expect(parsed.config.exercise).toBe('random-roots');
    }
  });

  it('serializes continuous mode using the literal "continuous"', () => {
    const config: RootNotesConfig = {
      exercise: 'root-notes',
      targetNote: 'A',
      durationSec: 300,
      continuous: true,
      maxFret: 12,
      showAllLabels: false,
      showRootMarkers: false,
      showFretNumbers: true,
      playSound: true,
      algorithm: 'fret-first'
    };
    expect(sessionHash(config)).toContain('duration=continuous');
  });
});
