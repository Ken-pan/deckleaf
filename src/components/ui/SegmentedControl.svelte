<script lang="ts">
  import { uiIndicator } from '../../ui-motion';
  type Option = {value: string; label: string; disabled?: boolean; title?: string; ariaLabel?: string};
  let {label, options, value = $bindable(''), disabled = false, onchange, class: className = ''}: {label: string; options: readonly Option[]; value?: string; disabled?: boolean; onchange?: (value: string) => void; class?: string} = $props();
  function choose(next: string) { value = next; onchange?.(next); }
  function navigate(event: KeyboardEvent, index: number) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const available = options.map((option, i) => ({option, i})).filter(({option}) => !option.disabled);
    if (disabled || !available.length) return;
    event.preventDefault(); event.stopPropagation();
    const at = available.findIndex(item => item.i === index);
    const next = event.key === 'Home' ? available[0] : event.key === 'End' ? available.at(-1)! : available[(at + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length];
    choose(next.option.value);
    const group = (event.currentTarget as HTMLElement).parentElement!;
    group.querySelectorAll<HTMLButtonElement>('button')[next.i]?.focus();
  }
</script>

<div class="seg ui-segmented {className}" role="group" aria-label={label} use:uiIndicator>
  {#each options as option, index}<button type="button" disabled={disabled || option.disabled} title={option.title} aria-label={option.ariaLabel} aria-pressed={value === option.value} onclick={() => choose(option.value)} onkeydown={event => navigate(event, index)}>{option.label}</button>{/each}
</div>
