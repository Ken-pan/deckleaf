<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  type Props = HTMLButtonAttributes & {
    variant?: 'quiet' | 'secondary' | 'primary' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    kind?: 'text' | 'icon';
    busy?: boolean;
    children?: Snippet;
  };
  let {variant = 'quiet', size = 'md', kind = 'text', busy = false, disabled = false, class: className = '', children, ...attributes}: Props = $props();
  function click(event: MouseEvent & {currentTarget: HTMLButtonElement}) {
    if (busy || event.currentTarget.matches(':disabled') || attributes['aria-disabled'] === true || attributes['aria-disabled'] === 'true') { event.preventDefault(); event.stopPropagation(); return; }
    return attributes.onclick?.call(event.currentTarget, event);
  }
  function key(event: KeyboardEvent & {currentTarget: HTMLButtonElement}) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
    if (busy || event.currentTarget.matches(':disabled') || attributes['aria-disabled'] === true || attributes['aria-disabled'] === 'true') {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); }
      return;
    }
    return attributes.onkeydown?.call(event.currentTarget, event);
  }
</script>

<button {...attributes} onclick={click} onkeydown={key} type={attributes.type ?? 'button'} class="ui-button {kind === 'icon' ? 'icon-btn' : 'text-btn'} {variant === 'secondary' ? 'ghost' : variant === 'quiet' ? '' : variant} {className}" data-size={size} disabled={disabled} aria-disabled={busy || attributes['aria-disabled'] || undefined} aria-busy={busy || undefined}>
  {#if busy}<span class="spinner" aria-hidden="true"></span>{/if}
  {@render children?.()}
</button>
