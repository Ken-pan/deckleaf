<script lang="ts">
  import {EyeOff} from '@lucide/svelte';
  import Button from './ui/Button.svelte';
  let {allHidden = false, preview = false, onunhide}: {
    allHidden?: boolean; preview?: boolean; onunhide: () => void;
  } = $props();
</script>

<div class="slide-visibility-notice" role="group" aria-label="Slide visibility">
  <EyeOff size={16} aria-hidden="true"/>
  <div class="visibility-copy">
    <span class="visibility-title">{preview ? 'Hidden in preview' : allHidden ? 'All slides hidden' : 'Hidden slide'}</span>
    <span class="visibility-detail">{preview ? 'Skipped after applying changes' : allHidden ? 'Unhide a slide to present' : 'Skipped in presentation'}</span>
  </div>
  {#if !preview}<Button class="visibility-restore" aria-label="Unhide slide" onclick={onunhide}>Unhide</Button>{/if}
</div>

<style>
  .slide-visibility-notice { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; pointer-events: auto; color: var(--text-secondary); }
  .slide-visibility-notice > :global(svg) { flex: none; }
  .visibility-copy { display: flex; flex-direction: column; gap: 0; min-width: 0; }
  .visibility-title { font-size: var(--ui-label); font-weight: var(--ui-weight-medium); line-height: var(--ui-line-body); }
  .visibility-detail { font-size: var(--ui-meta); line-height: var(--ui-line-body); overflow-wrap: anywhere; }
  .slide-visibility-notice :global(.visibility-restore) { flex: none; margin-left: 4px; min-height: 44px; }
</style>
