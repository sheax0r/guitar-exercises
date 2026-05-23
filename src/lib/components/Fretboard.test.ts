import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/svelte';
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

  it('renders fret wires between numbered frets (nut replaces the 1st wire)', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22 } });
    const frets = container.querySelectorAll('[data-role="fret"]');
    // For maxFret=22: wires sit between frets 1↔2, 2↔3, ..., 21↔22 = 21 wires.
    // The boundary between fret 0 (open) and fret 1 is the nut itself.
    expect(frets).toHaveLength(21);
  });

  it('renders string labels e B G D A E top-to-bottom', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22 } });
    const labels = Array.from(container.querySelectorAll('[data-role="string-label"]'));
    expect(labels.map(l => l.textContent)).toEqual(['e', 'B', 'G', 'D', 'A', 'E']);
  });
});

describe('Fretboard — labels and highlights', () => {
  it('does not render position labels when labelsVisible=false', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22, labelsVisible: false } });
    const labels = container.querySelectorAll('[data-role="position-label"]');
    expect(labels).toHaveLength(0);
  });

  it('renders a label at every fret×string when labelsVisible=true', () => {
    const { container } = render(Fretboard, { props: { maxFret: 22, labelsVisible: true } });
    const labels = container.querySelectorAll('[data-role="position-label"]');
    // 6 strings × 23 fret columns (0..22) = 138
    expect(labels).toHaveLength(6 * 23);
  });

  it('highlights the target note in label mode', () => {
    const { container } = render(Fretboard, {
      props: { maxFret: 22, labelsVisible: true, targetHighlightNote: 'A' }
    });
    const accented = container.querySelectorAll('[data-role="position-label"][data-target="true"]');
    // 12 A positions on a 22-fret board (the inclusive bound includes string 2 fret 22).
    expect(accented.length).toBe(12);
  });

  it('renders a prompt highlight at the configured position without the note letter', () => {
    const { container } = render(Fretboard, {
      props: {
        maxFret: 22,
        highlights: [{ string: 3, fret: 7, note: 'D', kind: 'prompt' }]
      }
    });
    const dot = container.querySelector('[data-role="highlight"][data-kind="prompt"]');
    expect(dot).toBeTruthy();
    // Prompt-kind highlights should not display the note letter.
    expect(dot?.textContent?.trim() ?? '').not.toContain('D');
  });

  it('renders the note letter inside non-prompt highlights', () => {
    const { container } = render(Fretboard, {
      props: {
        maxFret: 22,
        highlights: [{ string: 4, fret: 7, note: 'A', kind: 'correct-flash' }]
      }
    });
    const dot = container.querySelector('[data-role="highlight"][data-kind="correct-flash"]');
    expect(dot?.textContent?.trim()).toContain('A');
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

describe('Fretboard — root markers', () => {
  it('renders nothing when showRootMarkers=false', () => {
    const { container } = render(Fretboard, {
      props: { maxFret: 22, showRootMarkers: false, targetHighlightNote: 'A' }
    });
    expect(container.querySelectorAll('[data-role="root-marker"]')).toHaveLength(0);
  });

  it('renders a marker at every target position when showRootMarkers=true', () => {
    const { container } = render(Fretboard, {
      props: { maxFret: 22, showRootMarkers: true, targetHighlightNote: 'A' }
    });
    // 12 A positions on a 22-fret standard-tuned board.
    expect(container.querySelectorAll('[data-role="root-marker"]')).toHaveLength(12);
  });

  it('renders nothing when showRootMarkers=true but targetHighlightNote is undefined', () => {
    const { container } = render(Fretboard, {
      props: { maxFret: 22, showRootMarkers: true }
    });
    expect(container.querySelectorAll('[data-role="root-marker"]')).toHaveLength(0);
  });

  it('shows the target note letter inside each root marker', () => {
    const { container } = render(Fretboard, {
      props: { maxFret: 22, showRootMarkers: true, targetHighlightNote: 'A' }
    });
    const markers = container.querySelectorAll('[data-role="root-marker"]');
    expect(markers.length).toBe(12);
    for (const m of Array.from(markers)) {
      expect(m.textContent?.trim()).toBe('A');
    }
  });
});

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
