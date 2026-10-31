import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import IdeateScreen from './IdeateScreen.svelte';
import { settings } from '../ideate/state.svelte';

describe('IdeateScreen', () => {
  it('renders the recorder, settings and an empty job queue', async () => {
    render(IdeateScreen);
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();
    expect(screen.getByLabelText('Audio file to transcribe')).toBeInTheDocument();
    expect(screen.getByLabelText('Input source')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mic sensitivity')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Jobs/ }));
    expect(screen.getByText(/No jobs yet/)).toBeInTheDocument();
  });

  it('picking an input sets its snap and start-note defaults', async () => {
    render(IdeateScreen);
    await userEvent.click(screen.getByRole('button', { name: 'Whistle' }));
    expect(settings.snap).toBe(true);
    expect(settings.startNote).toBe(72);
    await userEvent.click(screen.getByRole('button', { name: 'Guitar' }));
    expect(settings.snap).toBe(false);
    expect(settings.startNote).toBe(40);
  });
});
