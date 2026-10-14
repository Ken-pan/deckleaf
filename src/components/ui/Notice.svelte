<script lang="ts">
  import './notice.css';
  import type { Snippet } from 'svelte';
  import { CircleCheck, Info, TriangleAlert, CircleAlert, X } from '@lucide/svelte';
  import { restoreFocus } from '../../ui-focus';
  import Button from './Button.svelte';
  let {tone = 'info', title, message, detail, actions, ondismiss, dismissLabel = 'Dismiss notification', live = true, indicator = true, class: className = ''}: {
    tone?: 'success' | 'info' | 'warning' | 'error' | 'progress'; title?: string; message?: string; detail?: string;
    actions?: Snippet; ondismiss?: () => void; dismissLabel?: string; live?: boolean; indicator?: boolean; class?: string;
  } = $props();
  let root: HTMLDivElement;
  function dismiss() {
    const heldFocus = root.contains(document.activeElement);
    ondismiss?.();
    if (heldFocus) queueMicrotask(() => restoreFocus());
  }
  function key(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !ondismiss || event.isComposing || event.defaultPrevented) return;
    event.preventDefault(); event.stopPropagation(); dismiss();
  }
</script>

<!-- Escape is scoped to the controls inside this notice; focus never moves here automatically. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={root} class="ui-notice {className}" data-tone={tone} onkeydown={key} role="group" aria-label={title || (tone === 'progress' ? 'Progress' : 'Notification')}>
  {#if indicator}<span class="ui-notice-icon" aria-hidden="true">{#if tone === 'progress'}<span class="spinner"></span>{:else if tone === 'success'}<CircleCheck size={18}/>{:else if tone === 'warning'}<TriangleAlert size={18}/>{:else if tone === 'error'}<CircleAlert size={18}/>{:else}<Info size={18}/>{/if}</span>{/if}
  <div class="ui-notice-content">
    <div class="ui-notice-copy" role={live ? tone === 'error' ? 'alert' : 'status' : undefined} aria-atomic={live ? 'true' : undefined}>
      {#if title}<strong>{title}</strong>{/if}
      {#if message}<p>{message}</p>{/if}
      {#if detail}<p class="ui-notice-detail">{detail}</p>{/if}
    </div>
    {#if actions}<div class="ui-notice-actions">{@render actions()}</div>{/if}
  </div>
  {#if ondismiss}<Button kind="icon" class="ui-notice-dismiss" aria-label={dismissLabel} onclick={dismiss}><X size={16}/></Button>{/if}
</div>
