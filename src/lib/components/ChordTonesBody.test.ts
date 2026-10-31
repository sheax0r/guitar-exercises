import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import ChordTonesBody from './ChordTonesBody.svelte';
import type { ChordTonesConfig } from '../exercise/chordtones/types';
import type { MetronomeOptions } from '../audio/metronome';

vi.mock('../audio/pluck', () => ({ midiAsPos: (m: number) => ({ string: 6, fret: m - 40 }), playPluck: () => {} }));
vi.mock('../audio/sequence', () => ({ playSequence: () => () => {} }));
vi.mock('../audio/drone', () => ({ startDrone: () => ({ stop() {} }), midiForDrone: () => 48 }));
vi.mock('../audio/context', () => ({ getAudioContext: () => ({ state: 'running', currentTime: 0, resume: () => Promise.resolve() }) }));
let metronome: MetronomeOptions | null = null;
vi.mock('../audio/metronome', () => ({ startMetronome: (_ctx: unknown, o: MetronomeOptions) => { metronome = o; return () => {}; } }));

const config: ChordTonesConfig = {
  exercise: 'chord-tones', progression: 'ii-V-I', keyRoot: 'C', target: '3rd', backing: 'chord',
  tempo: 'timed', bpm: 120, barsPerChord: 1, algorithm: 'fret-first', inputMode: 'click',
  micSensitivity: 0.5, micDeviceId: null, maxFret: 12, durationSec: 300, continuous: false,
  showFretNumbers: true, playSound: false
};

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('ChordTonesBody — timed', () => {
  beforeEach(() => { metronome = null; vi.spyOn(Math, 'random').mockReturnValue(0); });

  it('counts in one bar, changes chord every bar, and a missed change is a miss', async () => {
    const { container } = render(ChordTonesBody, { props: { config, onComplete: () => {}, onAbort: () => {} } });
    expect(metronome).not.toBeNull();
    const beat = async (b: number) => { metronome!.onBeat!(b, 0); await wait(5); await tick(); };
    for (const b of [0, 1, 2, 3]) await beat(b);
    expect(container.textContent).toContain('Count-in');
    await beat(4);
    expect(container.textContent).toContain('Dm7');
    // Answer Dm7 right (F at 1/1, nearest the 1/0 start).
    await fireEvent.click(container.querySelector('[data-role="hit"][data-string="1"][data-fret="1"]')!);
    expect(container.querySelector('.ok')!.textContent).toBe('✓ 1');
    for (const b of [5, 6, 7, 8]) await beat(b);
    expect(container.textContent).toContain('G7');
    // Let G7 go by unanswered: the change at beat 12 scores it as a miss.
    for (const b of [9, 10, 11, 12]) await beat(b);
    expect(container.textContent).toContain('Cmaj7');
    expect(container.querySelector('.bad')!.textContent).toBe('✗ 1');
  });
});
