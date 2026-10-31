import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import ChipGroup from './ChipGroup.svelte';
import NotePicker from './NotePicker.svelte';
import DurationHarness from './DurationHarness.test.svelte';

function chips(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button.chip'));
}

describe('ChipGroup', () => {
  it('click changes value, marks only that chip active, calls onpick', async () => {
    const onpick = vi.fn();
    const { container } = render(ChipGroup, {
      props: {
        value: 'a',
        label: 'Letters',
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', title: 'Bee' }],
        onpick
      }
    });
    expect(screen.getByRole('group', { name: 'Letters' })).toBeInTheDocument();
    const [a, b] = chips(container);
    expect(a).toHaveClass('chip-active');
    expect(b).toHaveAttribute('title', 'Bee');
    await fireEvent.click(b);
    expect(onpick).toHaveBeenCalledWith('b');
    expect(a).not.toHaveClass('chip-active');
    expect(a).toHaveAttribute('aria-pressed', 'false');
    expect(b).toHaveClass('chip-active');
    expect(b).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('NotePicker', () => {
  it('renders 12 note chips without randomLabel', () => {
    const { container } = render(NotePicker, { props: { value: 'C', label: 'Key' } });
    const c = chips(container);
    expect(c).toHaveLength(12);
    expect(c[0]).toHaveTextContent('C');
    expect(c[0]).toHaveClass('chip-active');
  });

  it('with randomLabel renders a leading random chip that selects random', async () => {
    const { container } = render(NotePicker, {
      props: { value: 'A', label: 'Target note', randomLabel: 'A/E/D' }
    });
    const c = chips(container);
    expect(c).toHaveLength(13);
    expect(c[0]).toHaveTextContent('A/E/D');
    await fireEvent.click(c[0]);
    expect(c[0]).toHaveAttribute('aria-pressed', 'true');
    expect(c.filter(x => x.classList.contains('chip-active'))).toHaveLength(1);
  });
});

describe('DurationPicker', () => {
  function state() {
    return screen.getByTestId('state').textContent;
  }
  function chip(name: string) {
    return screen.getByRole('button', { name });
  }

  it('Continuous sets continuous=true', async () => {
    render(DurationHarness);
    await fireEvent.click(chip('Continuous'));
    expect(state()).toBe('300|true');
    expect(chip('Continuous')).toHaveClass('chip-active');
  });

  it('Custom + typing 45 sets durationSec=45, continuous=false', async () => {
    render(DurationHarness, { props: { continuous: true } });
    await fireEvent.click(chip('Custom'));
    const input = screen.getByLabelText('Custom duration in seconds');
    await fireEvent.input(input, { target: { value: '45' } });
    expect(state()).toBe('45|false');
    expect(chip('Custom')).toHaveClass('chip-active');
  });

  it('preset picks the duration', async () => {
    render(DurationHarness, { props: { continuous: true } });
    await fireEvent.click(chip('1m'));
    expect(state()).toBe('60|false');
  });
});
