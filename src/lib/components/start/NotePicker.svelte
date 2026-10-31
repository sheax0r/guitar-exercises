<script lang="ts">
  import { CHROMATIC, NOTE_DISPLAY, type Note } from '../../music/notes';
  import ChipGroup from './ChipGroup.svelte';

  type Props = {
    value: Note | 'random'; // $bindable
    label: string;
    randomLabel?: string;
  };
  let { value = $bindable(), label, randomLabel }: Props = $props();

  const options = $derived([
    ...(randomLabel ? [{ value: 'random' as const, label: randomLabel }] : []),
    ...CHROMATIC.map(n => ({ value: n, label: NOTE_DISPLAY[n] }))
  ]);
</script>

<ChipGroup bind:value {options} {label} />
