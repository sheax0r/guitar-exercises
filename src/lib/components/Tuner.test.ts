import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Tuner from './Tuner.svelte';

describe('Tuner', () => {
  it('shows note, signed cents and in-tune colouring', () => {
    const { container, rerender } = render(Tuner, { props: { reading: { note: 'A4', cents: 10 } } });
    const el = container.querySelector('.tuner')!;
    expect(el.textContent).toContain('A4');
    expect(el.textContent).toContain('+10¢');
    expect(el.classList.contains('intune')).toBe(true);
    return rerender({ reading: { note: 'E2', cents: -30 } }).then(() => {
      expect(el.textContent).toContain('-30¢');
      expect(el.classList.contains('off')).toBe(true);
    });
  });

  it('shows a dash with no reading', () => {
    const { container } = render(Tuner, { props: { reading: null } });
    expect(container.querySelector('.tnote')!.textContent).toBe('–');
    expect(container.querySelector('.needle')).toBeNull();
  });
});
