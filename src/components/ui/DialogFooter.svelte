<script lang="ts">
  import type { Snippet } from 'svelte';
  let {info, actions, children, inset = false, stacked = false, class: className = ''}: {info?: Snippet; actions?: Snippet; children?: Snippet; inset?: boolean; stacked?: boolean; class?: string} = $props();
</script>

<footer class="dialog-footer {className}" class:dialog-footer-inset={inset} class:dialog-footer-stacked={stacked} class:dialog-footer-responsive={Boolean(info && actions)}>
  {#if children}{@render children()}{:else}
    {#if info}<div class="dialog-footer-info">{@render info()}</div>{/if}
    {#if actions}<div class="dialog-footer-actions">{@render actions()}</div>{/if}
  {/if}
</footer>
