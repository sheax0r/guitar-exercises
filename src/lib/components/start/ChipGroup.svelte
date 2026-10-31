<script lang="ts" generics="T">
  type Props = {
    value: T; // $bindable
    options: Array<{ value: T; label: string; title?: string }>;
    label: string;
    onpick?: (v: T) => void;
  };
  let { value = $bindable(), options, label, onpick }: Props = $props();

  function pick(v: T) {
    value = v;
    onpick?.(v);
  }
</script>

<div class="chips" role="group" aria-label={label}>
  {#each options as o}
    <button
      type="button"
      class="chip"
      class:chip-active={value === o.value}
      aria-pressed={value === o.value}
      title={o.title}
      onclick={() => pick(o.value)}
    >{o.label}</button>
  {/each}
</div>
