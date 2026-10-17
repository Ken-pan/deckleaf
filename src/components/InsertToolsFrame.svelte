<script lang="ts">
  import type {Snippet} from 'svelte';
  import '../insert-tools-frame.css';
  import Button from './ui/Button.svelte';
  let {compact=false,failed=false,primary,resources,more}: {compact?:boolean;failed?:boolean;primary?:Snippet;resources?:Snippet;more?:Snippet}=$props();
</script>

<!-- The loading state and the controls share their responsive geometry. -->
<div class="toolbar-group insert-tools" aria-busy={!primary&&!failed||undefined}>
  {#if failed}<div class="insert-error" role="alert"><span>Tools unavailable</span><Button size="sm" onclick={()=>window.location.reload()}>Refresh app</Button></div>
  {:else if !primary}<span class="sr-only" role="status">Loading insert tools…</span>{/if}
  <div class="insert-primary" role="group" aria-label="Canvas tools">
    {#if primary}{@render primary()}{:else}
      {#each [false,false,true,true,true] as split}<span class="insert-placeholder" class:split></span>{/each}
    {/if}
  </div>
  <div class="resource-tools" class:compact role="group" aria-label="Resource categories">
    {#if resources}{@render resources()}{:else}{#each [0,1,2] as i}<span class="insert-placeholder"></span>{/each}{/if}
  </div>
  <div class="insert-secondary">
    {#if more}{@render more()}{:else}<span class="insert-placeholder"></span>{/if}
  </div>
</div>


