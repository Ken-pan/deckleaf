<script lang="ts">
  import { X } from '@lucide/svelte';
  import IconButton from './IconButton.svelte';
  let {title, subtitle, titleId, closeLabel = 'Close', onclose, heading = $bindable(), hidden = false, class: className = ''}: {title: string; subtitle?: string; titleId?: string; closeLabel?: string; onclose: () => void; heading?: HTMLHeadingElement; hidden?: boolean; class?: string} = $props();
</script>

<header class="modal-head ui-dialog-header {className}" {hidden}>
  <div class="dialog-heading"><h2 id={titleId} bind:this={heading} tabindex="-1">{title}</h2>{#if subtitle}<p class="dialog-subtitle">{subtitle}</p>{/if}</div>
  <IconButton label={closeLabel} size="lg" onclick={onclose}><X aria-hidden="true" /></IconButton>
</header>
