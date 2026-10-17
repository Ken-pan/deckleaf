<script lang="ts">
  import type {Snippet} from 'svelte';
  import Dialog from './Dialog.svelte';
  import {Button,DialogFooter} from './ui';
  let {children,fontSize,oncommit,onclose}:{children:Snippet;fontSize:number;oncommit:()=>void;onclose:()=>void}=$props();
</script>
<Dialog title="Edit text" {onclose} class="canvas-mobile-text-dialog">
  <div class="mobile-text-field" style:--editing-font="{Math.max(16,Math.min(24,fontSize))}px">{@render children()}</div>
  <p class="hint">Text keeps its formatting and current box. Resize the box if longer copy no longer fits.</p>
  {#snippet footer()}<DialogFooter>{#snippet actions()}<Button onpointerdown={event=>event.preventDefault()} onclick={onclose}>Cancel</Button><Button variant="primary" onpointerdown={event=>event.preventDefault()} onclick={oncommit}>Done</Button>{/snippet}</DialogFooter>{/snippet}
</Dialog>
<style>
  .mobile-text-field{min-height:160px;padding:12px;border:1px solid var(--border-default);border-radius:var(--r-control);background:var(--surface-input)}
  .mobile-text-field :global(.text-content){font-size:var(--editing-font)!important;color:var(--text-primary)!important;min-height:136px;height:auto!important;overflow:visible!important;display:block!important;white-space:pre-wrap;overflow-wrap:anywhere;outline:none}
  .mobile-text-field:focus-within{outline:2px solid var(--text-primary);outline-offset:0}
  .mobile-text-field :global(.text-flow){width:100%;white-space:pre-wrap}
  .hint{margin-top:12px}
</style>
